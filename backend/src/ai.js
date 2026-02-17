const DEFAULT_OPENAI_TIMEOUT = parseInt(process.env.OPENAI_TIMEOUT_MS) || 60000;

/**
 * Fallback analysis when OpenAI is not available
 * @param {object} summary 
 * @returns {object}
 */
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
      cta: 'Jetzt starten',
    },
    palette: {
      primary: '#0B5FFF',
      background: '#0B1220',
      text: '#E6EAF2'
    }
  };
}

/**
 * Analyzes website using OpenAI or falls back to heuristic analysis
 * @param {object} params
 * @param {string} params.url
 * @param {object} params.summary
 * @param {string} params.html
 * @returns {Promise<object>}
 */
export async function analyzeWithAI({ url, summary, html }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'using_fallback_analysis',
      reason: 'no_api_key',
    }));
    return fallbackAnalysis(summary);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_OPENAI_TIMEOUT);

  try {
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
            `Analysiere diese Website-Daten als JSON und gib exakt folgendes JSON-Schema zurück (ohne Markdown Code-Block, nur reines JSON):
` +
            `{"issues":["string"],"suggestions":["string"],"improvedCopy":{"headline":"string","subheadline":"string","cta":"string"},"palette":{"primary":"string","background":"string","text":"string"}}
` +
            `Daten: ${JSON.stringify(user)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const t = await res.text();
      
      // If rate limited or service error, fallback to heuristic
      if (res.status === 429 || res.status >= 500) {
        console.warn(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          event: 'openai_error_fallback',
          status: res.status,
          error: t,
        }));
        return fallbackAnalysis(summary);
      }
      
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
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(content.slice(start, end + 1));
        } catch {
          throw new Error('OpenAI: could not parse JSON response');
        }
      } else {
        throw new Error('OpenAI: could not parse JSON');
      }
    }

    // Validate required fields
    if (!parsed.improvedCopy || !parsed.palette) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'openai_invalid_response',
        response: parsed,
      }));
      return fallbackAnalysis(summary);
    }

    return { provider: 'openai', ...parsed };
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err.name === 'AbortError') {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'openai_timeout_fallback',
      }));
      return fallbackAnalysis(summary);
    }
    
    // For any other error, fallback to heuristic analysis
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'openai_error_fallback',
      error: err?.message,
    }));
    return fallbackAnalysis(summary);
  }
}
