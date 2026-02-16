function fallbackAnalysis(summary) {
  const issues = [];
  const suggestions = [];

  if (!summary.title) issues.push('Kein <title> gefunden.');
  if (summary.title && summary.title.length < 10) issues.push('Title wirkt sehr kurz.');
  if (!summary.metaDescription) issues.push('Keine Meta-Description gefunden.');
  if (summary.metaDescription && summary.metaDescription.length > 170)
    issues.push('Meta-Description ist sehr lang (evtl. kürzen).');
  if (!summary.h1) issues.push('Kein H1 gefunden.');

  suggestions.push('Füge klare Call-to-Actions (CTA) im sichtbaren Bereich hinzu.');
  suggestions.push('Optimiere Lighthouse Core Web Vitals (Bilder komprimieren, CSS/JS minimieren).');
  suggestions.push('Verbessere semantische Struktur (H1/H2, ARIA Labels, Alt-Texte).');
  suggestions.push('Nutze konsistente Typografie und genügend Kontrast (WCAG).');

  return {
    provider: 'heuristic',
    issues,
    suggestions,
    improvedCopy: {
      headline: summary.h1 || summary.title || 'Willkommen',
      subheadline: summary.metaDescription || 'Wir optimieren Ihre Website für Performance, SEO und Conversion.',
    },
    palette: {
      primary: '#0B5FFF',
      background: '#0B1220',
      text: '#E6EAF2'
    }
  };
}

export async function analyzeWithAI({ url, summary, html }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) return fallbackAnalysis(summary);

  const system = `Du bist ein Senior UX/SEO/Performance Consultant. Du analysierst eine Website und lieferst konkrete Optimierungen.`;
  const user = {
    url,
    summary,
    htmlSnippet: html.slice(0, 12000)
  };

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content:
          `Analysiere diese Website-Daten als JSON und gib exakt folgendes JSON-Schema zurück (ohne Markdown):\n` +
          `{"issues":[string],"suggestions":[string],"improvedCopy":{"headline":string,"subheadline":string,"cta":string},"palette":{"primary":string,"background":string,"text":string}}\n` +
          `Daten: ${JSON.stringify(user)}`,
      },
    ],
    temperature: 0.4,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${t}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI: empty response');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON if model returned extra text
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) parsed = JSON.parse(content.slice(start, end + 1));
    else throw new Error('OpenAI: could not parse JSON');
  }

  return { provider: 'openai', ...parsed };
}
