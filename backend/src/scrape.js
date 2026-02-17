import * as cheerio from 'cheerio';

const DEFAULT_TIMEOUT = parseInt(process.env.SCRAPE_TIMEOUT_MS) || 30000;
const MAX_SIZE_BYTES = (parseInt(process.env.SCRAPE_MAX_SIZE_MB) || 10) * 1024 * 1024;
const MAX_REDIRECTS = parseInt(process.env.SCRAPE_MAX_REDIRECTS) || 5;

/**
 * Scrapes a website with timeouts and size limits
 * @param {string} url - The URL to scrape
 * @returns {Promise<{html: string, summary: object}>}
 * @throws {Error} If scraping fails
 */
export async function scrapeWebsite(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'WebsiteOptimizerBot/1.0 (+https://example.local)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.5',
        'accept-encoding': 'gzip, deflate, br',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`Scrape failed: HTTP ${res.status} ${res.statusText}`);
    }
    
    // Check content length if available
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
      throw new Error(`Content too large: ${contentLength} bytes exceeds limit of ${MAX_SIZE_BYTES} bytes`);
    }
    
    const html = await res.text();
    
    // Check actual size
    const sizeInBytes = Buffer.byteLength(html, 'utf8');
    if (sizeInBytes > MAX_SIZE_BYTES) {
      throw new Error(`Content too large: ${sizeInBytes} bytes exceeds limit of ${MAX_SIZE_BYTES} bytes`);
    }
    
    const $ = cheerio.load(html, {
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
    });

    // Extract a compact summary for analysis.
    const title = ($('title').first().text() || '').trim();
    const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();
    const h1 = ($('h1').first().text() || '').trim();
    const textSample = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);

    const links = [];
    $('a[href]').slice(0, 30).each((_, el) => {
      const href = $(el).attr('href');
      // Basic XSS protection: skip javascript: and data: URLs
      if (href && !href.toLowerCase().startsWith('javascript:') && !href.toLowerCase().startsWith('data:')) {
        links.push({
          text: ($(el).text() || '').trim().slice(0, 80),
          href: href,
        });
      }
    });

    return {
      html: html.slice(0, 500000), // Limit stored HTML size
      summary: {
        title: title.slice(0, 200),
        metaDescription: metaDescription.slice(0, 500),
        h1: h1.slice(0, 200),
        textSample,
        links,
      },
    };
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err.name === 'AbortError') {
      throw new Error(`Scrape timeout after ${DEFAULT_TIMEOUT}ms`);
    }
    if (err.code === 'ENOTFOUND') {
      throw new Error(`Domain not found: ${url}`);
    }
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused: ${url}`);
    }
    if (err.code === 'ETIMEDOUT') {
      throw new Error(`Connection timeout: ${url}`);
    }
    
    throw err;
  }
}
