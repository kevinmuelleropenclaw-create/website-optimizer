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

export function enqueue(jobId) {
  queue.push(jobId);
  tick();
}

async function tick() {
  if (running) return;
  const jobId = queue.shift();
  if (!jobId) return;

  running = true;
  try {
    await processJob(jobId);
  } catch (err) {
    updateJob(jobId, {
      status: 'failed',
      step: 'failed',
      progress: 100,
      error: String(err?.message || err),
    });
  } finally {
    running = false;
    setImmediate(tick);
  }
}

async function processJob(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error('Job not found');

  updateJob(jobId, { status: 'processing', step: 'scraping', progress: 10, error: null });

  const scraped = await scrapeWebsite(job.url);
  const jobDir = path.join(jobsRoot, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const scrapedPath = path.join(jobDir, 'scraped.html');
  fs.writeFileSync(scrapedPath, scraped.html, 'utf8');
  updateJob(jobId, { scrapedHtmlPath: scrapedPath, step: 'analysis', progress: 35 });

  const analysis = await analyzeWithAI({ url: job.url, summary: scraped.summary, html: scraped.html });
  const analysisPath = path.join(jobDir, 'analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), 'utf8');
  updateJob(jobId, { step: 'optimization', progress: 60 });

  const { outDir } = generateOptimizedSite({
    jobId,
    url: job.url,
    analysis,
    outBaseDir: jobsRoot,
  });
  updateJob(jobId, { optimizedDirPath: outDir, step: 'deployment', progress: 80 });

  const siteName = process.env.NETLIFY_SITE_NAME || `opt-${crypto.randomBytes(3).toString('hex')}`;
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
}
