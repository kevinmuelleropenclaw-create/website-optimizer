import fs from 'node:fs';
import path from 'node:path';

export function generateOptimizedSite({ jobId, url, analysis, outBaseDir }) {
  const outDir = path.join(outBaseDir, jobId, 'site');
  fs.mkdirSync(outDir, { recursive: true });

  const headline = analysis?.improvedCopy?.headline || 'Optimierte Website';
  const subheadline = analysis?.improvedCopy?.subheadline || 'Schneller. Klarer. Mehr Conversion.';
  const cta = analysis?.improvedCopy?.cta || 'Kontakt aufnehmen';
  const primary = analysis?.palette?.primary || '#0B5FFF';
  const background = analysis?.palette?.background || '#0B1220';
  const text = analysis?.palette?.text || '#E6EAF2';

  const indexHtml = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(headline)} | Optimiert</title>
  <meta name="description" content="${escapeHtml(subheadline).slice(0, 160)}" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="container hero">
    <div class="badge">Optimiert für Performance • SEO • UX</div>
    <h1>${escapeHtml(headline)}</h1>
    <p class="lead">${escapeHtml(subheadline)}</p>
    <div class="actions">
      <a class="btn" href="#kontakt">${escapeHtml(cta)}</a>
      <a class="btn secondary" href="${escapeAttr(url)}" target="_blank" rel="noreferrer">Original ansehen</a>
    </div>
    <div class="stats">
      <div class="stat"><div class="k">Schneller</div><div class="v">Minified CSS/JS</div></div>
      <div class="stat"><div class="k">SEO</div><div class="v">Meta + Struktur</div></div>
      <div class="stat"><div class="k">UX</div><div class="v">Kontrast + CTA</div></div>
    </div>
  </header>

  <main class="container">
    <section class="grid">
      <div class="card">
        <h2>Top-Optimierungen</h2>
        <ul>
          ${(analysis?.suggestions || []).slice(0, 8).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h2>Gefundene Issues</h2>
        <ul>
          ${(analysis?.issues || []).slice(0, 8).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
    </section>

    <section id="kontakt" class="card contact">
      <h2>Kontakt</h2>
      <p>Diese Seite ist eine automatisch generierte, optimierte Demo basierend auf der Analyse von <strong>${escapeHtml(url)}</strong>.</p>
      <form id="contactForm">
        <label>
          E‑Mail
          <input name="email" type="email" required placeholder="name@firma.de" />
        </label>
        <label>
          Nachricht
          <textarea name="message" rows="4" required placeholder="Wobei können wir helfen?"></textarea>
        </label>
        <button class="btn" type="submit">Absenden</button>
        <p class="hint">(Demo-Formular — kein Versand.)</p>
      </form>
    </section>
  </main>

  <footer class="container footer">
    <small>Generiert von Website Optimizer • Job ${escapeHtml(jobId)}</small>
  </footer>

  <script src="/app.js"></script>
</body>
</html>`;

  const css = `:root{
  --primary:${primary};
  --bg:${background};
  --text:${text};
  --muted: rgba(230,234,242,.75);
  --card: rgba(255,255,255,.06);
  --border: rgba(255,255,255,.12);
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  background: radial-gradient(1200px 600px at 20% 0%, rgba(11,95,255,.25), transparent), var(--bg);
  color:var(--text);
  line-height:1.5;
}
.container{max-width:980px;margin:0 auto;padding:24px}
.hero{padding-top:56px;padding-bottom:24px}
.badge{display:inline-block;padding:6px 10px;border:1px solid var(--border);background:rgba(0,0,0,.15);border-radius:999px;color:var(--muted);font-size:13px}
.lead{color:var(--muted);max-width:70ch}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0 8px}
.btn{
  display:inline-flex;align-items:center;justify-content:center;
  padding:10px 14px;border-radius:12px;
  background:var(--primary);color:white;text-decoration:none;
  border:1px solid rgba(255,255,255,.08);
  font-weight:600;
}
.btn.secondary{background:transparent;color:var(--text);border-color:var(--border)}
.btn:hover{filter:brightness(1.05)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}
.stat{padding:12px;border:1px solid var(--border);background:var(--card);border-radius:14px}
.stat .k{font-weight:700}
.stat .v{color:var(--muted);font-size:13px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{padding:18px;border:1px solid var(--border);background:var(--card);border-radius:16px}
.card h2{margin-top:0}
ul{margin:0;padding-left:18px}
li{margin:6px 0;color:var(--muted)}
label{display:block;margin:10px 0;color:var(--muted)}
input,textarea{
  width:100%;margin-top:6px;padding:10px 12px;border-radius:12px;
  border:1px solid var(--border);background:rgba(0,0,0,.18);color:var(--text)
}
.footer{color:var(--muted);padding-top:0}
.hint{color:var(--muted);font-size:12px}
@media (max-width: 760px){
  .stats{grid-template-columns:1fr}
  .grid{grid-template-columns:1fr}
}
`;

  const js = `document.getElementById('contactForm')?.addEventListener('submit', (e)=>{
  e.preventDefault();
  alert('Danke! (Demo — Nachricht wurde nicht versendet.)');
});
`;

  fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml, 'utf8');
  fs.writeFileSync(path.join(outDir, 'styles.css'), css, 'utf8');
  fs.writeFileSync(path.join(outDir, 'app.js'), js, 'utf8');

  return { outDir };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('`', '&#96;');
}
