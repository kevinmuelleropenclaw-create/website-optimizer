import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'jobs.sqlite'));

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  step TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  scrapedHtmlPath TEXT,
  optimizedDirPath TEXT,
  netlifySiteId TEXT,
  netlifyUrl TEXT
);
`);

export function nowIso() {
  return new Date().toISOString();
}

export function insertJob({ id, url }) {
  const ts = nowIso();
  db.prepare(`
    INSERT INTO jobs (id, url, status, progress, step, createdAt, updatedAt)
    VALUES (@id, @url, 'queued', 0, 'queued', @ts, @ts)
  `).run({ id, url, ts });
}

export function updateJob(id, patch) {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k}=@${k}`).join(', ');
  db.prepare(`UPDATE jobs SET ${sets}, updatedAt=@updatedAt WHERE id=@id`).run({
    id,
    ...patch,
    updatedAt: nowIso(),
  });
}

export function getJob(id) {
  return db.prepare('SELECT * FROM jobs WHERE id=?').get(id);
}

export function listQueuedJobs(limit = 10) {
  return db
    .prepare("SELECT * FROM jobs WHERE status IN ('queued','processing') ORDER BY createdAt ASC LIMIT ?")
    .all(limit);
}
