import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getJob, updateJob } from './db.js';
import { scrapeWebsite } from './scrape.js';
import { analyzeWithAI } from './ai.js';
import { generateOptimizedSite } from './generate.js';
import { deployToNetlify } from './netlify.js';

const jobsRoot = path.resolve(process.cwd(), 'data', 'jobs');
fs.mkdirSync(jobsRoot, { recursive: true });

let running = false;
const queue = [];
const WORKER_TIMEOUT = parseInt(process.env.WORKER_TIMEOUT_MS) || 5 * 60 * 1000; // 5 minutes

/**
 * Add a job to the processing queue
 * @param {string} jobId 
 */
export function enqueue(jobId) {
  queue.push(jobId);
  tick();
}

/**
 * Process the next job in queue
 */
async function tick() {
  if (running) return;
  const jobId = queue.shift();
  if (!jobId) return;

  running = true;
  const startTime = Date.now();
  
  try {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'job_started',
      jobId,
    }));
    
    await processJobWithTimeout(jobId, WORKER_TIMEOUT);
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'job_completed',
      jobId,
      duration: Date.now() - startTime,
    }));
  } catch (err) {
    const errorMessage = err?.message || String(err);
    
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'job_failed',
      jobId,
      error: errorMessage,
      duration: Date.now() - startTime,
    }));
    
    updateJob(jobId, {
      status: 'failed',
      step: 'failed',
      progress: 100,
      error: errorMessage,
    });
  } finally {
    running = false;
    setImmediate(tick);
  }
}

/**
 * Process a job with timeout
 * @param {string} jobId 
 * @param {number} timeoutMs 
 * @returns {Promise<void>}
 */
async function processJobWithTimeout(jobId, timeoutMs) {
  return Promise.race([
    processJob(jobId),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Job timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Process a single job through all stages
 * @param {string} jobId 
 */
async function processJob(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error('Job not found');

  // Stage 1: Scraping
  updateJob(jobId, { 
    status: 'processing', 
    step: 'scraping', 
    progress: 10, 
    error: null 
  });

  const scraped = await scrapeWebsite(job.url);
  const jobDir = path.join(jobsRoot, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const scrapedPath = path.join(jobDir, 'scraped.html');
  fs.writeFileSync(scrapedPath, scraped.html, 'utf8');
  
  updateJob(jobId, { 
    scrapedHtmlPath: scrapedPath, 
    step: 'analysis', 
    progress: 35 
  });

  // Stage 2: AI Analysis
  const analysis = await analyzeWithAI({ 
    url: job.url, 
    summary: scraped.summary, 
    html: scraped.html 
  });
  const analysisPath = path.join(jobDir, 'analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), 'utf8');
  
  updateJob(jobId, { 
    step: 'optimization', 
    progress: 60 
  });

  // Stage 3: Generate optimized site
  const { outDir } = generateOptimizedSite({
    jobId,
    url: job.url,
    analysis,
    outBaseDir: jobsRoot,
  });
  
  updateJob(jobId, { 
    optimizedDirPath: outDir, 
    step: 'deployment', 
    progress: 80 
  });

  // Stage 4: Deploy to Netlify
  const siteName = process.env.NETLIFY_SITE_NAME || `opt-${crypto.randomBytes(3).toString('hex')}`;
  
  try {
    const deploy = await deployToNetlify({
      dir: outDir,
      siteId: process.env.NETLIFY_SITE_ID || null,
      siteName: process.env.NETLIFY_SITE_ID ? null : siteName,
    });

    updateJob(jobId, {
      status: 'done',
      step: 'done',
      progress: 100,
      netlifySiteId: deploy.siteId,
      netlifyUrl: deploy.url,
    });
  } catch (deployErr) {
    // If deployment fails, still save the generated site locally
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'deployment_failed',
      jobId,
      error: deployErr?.message,
      localPath: outDir,
    }));
    throw new Error(`Deployment failed: ${deployErr?.message}. Generated site saved locally.`);
  }
}

/**
 * Get current queue status
 * @returns {{queueLength: number, isProcessing: boolean}}
 */
export function getQueueStatus() {
  return {
    queueLength: queue.length,
    isProcessing: running,
  };
}
