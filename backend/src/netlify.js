import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.netlify.com/api/v1';

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

function walkFiles(rootDir) {
  const out = [];
  function rec(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) rec(p);
      else out.push(p);
    }
  }
  rec(rootDir);
  return out;
}

async function apiFetch(url, { token, method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Netlify API error: ${res.status} ${t}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function deployToNetlify({ dir, siteId, siteName }) {
  const token = process.env.NETLIFY_TOKEN;
  if (!token) throw new Error('NETLIFY_TOKEN missing');

  // 1) Ensure site
  let site = null;
  if (siteId) {
    site = await apiFetch(`${API}/sites/${siteId}`, { token });
  } else {
    // Create new site (optionally with name)
    site = await apiFetch(`${API}/sites`, {
      token,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(siteName ? { name: siteName } : {}),
    });
    siteId = site.id;
  }

  // 2) Build file map (path -> sha1)
  const absFiles = walkFiles(dir);
  const files = {};
  const fileBuffers = new Map();
  for (const abs of absFiles) {
    const rel = path.relative(dir, abs).replaceAll('\\', '/');
    const buf = fs.readFileSync(abs);
    fileBuffers.set(rel, buf);
    files[`/${rel}`] = sha1(buf);
  }

  // 3) Create deploy
  const deploy = await apiFetch(`${API}/sites/${siteId}/deploys`, {
    token,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files }),
  });

  const required = deploy.required || [];

  // 4) Upload required files
  for (const p of required) {
    const rel = p.startsWith('/') ? p.slice(1) : p;
    const buf = fileBuffers.get(rel);
    if (!buf) continue;
    await apiFetch(`${API}/deploys/${deploy.id}/files/${encodeURIComponent(p)}`, {
      token,
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream' },
      body: buf,
    });
  }

  // 5) Fetch deploy info (gives deploy_url)
  const finalDeploy = await apiFetch(`${API}/deploys/${deploy.id}`, { token });

  const url = finalDeploy?.ssl_url || finalDeploy?.url || finalDeploy?.deploy_url;
  return { siteId, url, deployId: deploy.id };
}
