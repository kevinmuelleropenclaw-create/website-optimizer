import * as cheerio from 'cheerio';

export async function scrapeWebsite(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'WebsiteOptimizerBot/1.0 (+https://example.local)'
    }
  });
  if (!res.ok) {
    throw new Error(`Scrape failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  // Extract a compact summary for analysis.
  const title = ($('title').first().text() || '').trim();
  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();
  const h1 = ($('h1').first().text() || '').trim();
  const textSample = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);

  const links = [];
  $('a[href]').slice(0, 30).each((_, el) => {
    links.push({
      text: ($(el).text() || '').trim().slice(0, 80),
      href: $(el).attr('href'),
    });
  });

  return {
    html,
    summary: {
      title,
      metaDescription,
      h1,
      textSample,
      links,
    },
  };
}
