import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

import { insertJob, getJob } from './db.js';
import { validateUrl } from './validate.js';
import { enqueue } from './worker.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression middleware
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || (isProduction ? false : '*'),
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.API_RATE_LIMIT_MAX) || 10, // limit each IP to 10 API calls per hour
  message: { error: 'API rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use('/api/', apiLimiter);

// Body parsing with limits
app.use(express.json({ 
  limit: process.env.MAX_JSON_SIZE || '1mb',
  strict: true,
}));

// Request timeout middleware
const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000;
app.use((req, res, next) => {
  res.setTimeout(requestTimeout, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Static files
const frontendDir = path.resolve(process.cwd(), '..', 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use('/', express.static(frontendDir, {
    maxAge: isProduction ? '1d' : 0,
    etag: true,
    lastModified: true,
  }));
}

// Health check with detailed status
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    env: isProduction ? 'production' : 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Create job endpoint
app.post('/api/jobs', async (req, res) => {
  try {
    const url = validateUrl(req.body?.url);
    const id = crypto.randomUUID();
    
    // Log job creation (structured logging)
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'job_created',
      jobId: id,
      url: url,
      ip: req.ip,
    };
    console.log(JSON.stringify(logEntry));
    
    insertJob({ id, url });
    enqueue(id);
    res.status(201).json({ id });
  } catch (err) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      event: 'job_creation_failed',
      error: err?.message,
      ip: req.ip,
    };
    console.log(JSON.stringify(logEntry));
    
    res.status(400).json({ 
      error: String(err?.message || err),
      code: 'VALIDATION_ERROR',
    });
  }
});

// Get job status
app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ 
      error: 'Job not found',
      code: 'NOT_FOUND',
    });
  }
  
  res.json({
    id: job.id,
    url: job.url,
    status: job.status,
    step: job.step,
    progress: job.progress,
    error: job.error,
    netlifyUrl: job.netlifyUrl,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

// Server-Sent Events stream for progress
app.get('/api/jobs/:id/events', (req, res) => {
  const id = req.params.id;
  
  // Validate job exists before starting SSE
  const job = getJob(id);
  if (!job) {
    return res.status(404).json({ 
      error: 'Job not found',
      code: 'NOT_FOUND',
    });
  }
  
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no'); // Disable nginx buffering

  let last = null;
  const intervalMs = 750;
  const maxDurationMs = parseInt(process.env.SSE_MAX_DURATION_MS) || 10 * 60 * 1000; // 10 minutes max
  const startTime = Date.now();
  
  const timer = setInterval(() => {
    // Check for timeout
    if (Date.now() - startTime > maxDurationMs) {
      clearInterval(timer);
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream timeout', code: 'TIMEOUT' })}\n\n`);
      return res.end();
    }
    
    const job = getJob(id);
    if (!job) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Job not found', code: 'NOT_FOUND' })}\n\n`);
      clearInterval(timer);
      return res.end();
    }
    
    const payload = {
      id: job.id,
      status: job.status,
      step: job.step,
      progress: job.progress,
      error: job.error,
      netlifyUrl: job.netlifyUrl,
      updatedAt: job.updatedAt,
    };
    const s = JSON.stringify(payload);
    if (s !== last) {
      res.write(`data: ${s}\n\n`);
      last = s;
    }
    if (job.status === 'done' || job.status === 'failed') {
      clearInterval(timer);
      // allow client to receive last event
      setTimeout(() => res.end(), 250);
    }
  }, intervalMs);

  req.on('close', () => clearInterval(timer));
});

// Global error handler
app.use((err, req, res, next) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    event: 'unhandled_error',
    error: isProduction ? 'Internal server error' : err?.message,
    stack: isProduction ? undefined : err?.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  };
  console.error(JSON.stringify(logEntry));
  
  res.status(err.status || 500).json({
    error: isProduction ? 'Internal server error' : err?.message,
    code: 'INTERNAL_ERROR',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    path: req.path,
  });
});

const port = Number(process.env.PORT || 8080);
const server = app.listen(port, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'server_started',
    port,
    env: isProduction ? 'production' : 'development',
  }));
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'shutdown_initiated',
    signal,
  }));
  
  server.close(() => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'server_closed',
    }));
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'forced_shutdown',
    }));
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
