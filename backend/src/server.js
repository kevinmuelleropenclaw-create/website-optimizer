import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

import { insertJob, getJob } from './db.js';
import { validateUrl } from './validate.js';
import { enqueue } from './worker.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const frontendDir = path.resolve(process.cwd(), '..', 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use('/', express.static(frontendDir));
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/jobs', async (req, res) => {
  try {
    const url = validateUrl(req.body?.url);
    const id = crypto.randomUUID();
    insertJob({ id, url });
    enqueue(id);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: String(err?.message || err) });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not_found' });
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

// Simple Server-Sent Events stream for progress
app.get('/api/jobs/:id/events', (req, res) => {
  const id = req.params.id;
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');

  let last = null;
  const timer = setInterval(() => {
    const job = getJob(id);
    if (!job) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'not_found' })}\n\n`);
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
  }, 750);

  req.on('close', () => clearInterval(timer));
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Serving frontend from: ${frontendDir}`);
});
