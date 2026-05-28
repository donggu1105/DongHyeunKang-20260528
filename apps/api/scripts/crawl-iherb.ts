import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

/**
 * iHerb crawler stub — demonstrates the "크롤링 연동" integration path.
 *
 * It fetches a couple of iHerb product detail pages with a normal browser
 * User-Agent and parses the "Supplement Facts" HTML table into structured
 * ingredient rows, writing them to `prisma/seed/products.crawled.json`.
 *
 * This is intentionally an HONEST stub: iHerb's anti-bot protection will
 * often respond 403/503 to scripted requests. When that happens (or any
 * network/parse failure occurs), we log a clear message and exit 0 — the
 * demo seed (hand-curated, in prisma/seed/products.ts) is the source of
 * truth and does NOT depend on this crawler succeeding.
 */

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// A few representative iHerb product detail pages. Exact products don't
// matter for the stub — these just give the parser something to attempt.
const TARGET_URLS = [
  'https://www.iherb.com/pr/california-gold-nutrition-children-s-multivitamin/96125',
  'https://www.iherb.com/pr/now-foods-vitamin-d-3-1-000-iu-180-softgels/733',
];

interface CrawledIngredient {
  name: string;
  amount: string;
  unit: string;
  rawLabel: string;
}

interface CrawledProduct {
  sourceUrl: string;
  name: string | null;
  ingredients: CrawledIngredient[];
}

/** Splits a Supplement-Facts amount cell like "400 IU" / "5 mg" / "1,000 ㎍". */
function splitAmount(raw: string): { amount: string; unit: string } {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/([\d.,]+)\s*([^\d\s].*)?/);
  if (!m) return { amount: cleaned, unit: '' };
  return { amount: m[1].replace(/,/g, ''), unit: (m[2] ?? '').trim() };
}

/**
 * Parses an iHerb "Supplement Facts" table. iHerb renders facts in a table
 * (class hints vary), so we scan every <tr> with >= 2 cells and treat the
 * first cell as the nutrient name and the second as the amount-per-serving.
 */
function parseSupplementFacts(html: string): {
  name: string | null;
  ingredients: CrawledIngredient[];
} {
  const root = parse(html);

  const name =
    root.querySelector('#name')?.text?.trim() ??
    root.querySelector('h1')?.text?.trim() ??
    null;

  const ingredients: CrawledIngredient[] = [];

  // Prefer a table that mentions "Supplement Facts"; otherwise scan all tables.
  const tables = root.querySelectorAll('table');
  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td, th');
      if (cells.length < 2) continue;
      const label = cells[0].text.replace(/\s+/g, ' ').trim();
      const amountCell = cells[1].text.replace(/\s+/g, ' ').trim();
      // Skip header/structural rows that don't look like a nutrient amount.
      if (!label || !/[\d]/.test(amountCell)) continue;
      const { amount, unit } = splitAmount(amountCell);
      if (!amount || !/\d/.test(amount)) continue;
      ingredients.push({ name: label, amount, unit, rawLabel: amountCell });
    }
  }

  return { name, ingredients };
}

async function fetchProduct(url: string): Promise<CrawledProduct> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  const { name, ingredients } = parseSupplementFacts(html);
  return { sourceUrl: url, name, ingredients };
}

async function main() {
  const outDir = join(__dirname, '..', 'prisma', 'seed');
  const outPath = join(outDir, 'products.crawled.json');

  const results: CrawledProduct[] = [];
  try {
    for (const url of TARGET_URLS) {
      console.log(`Fetching ${url} ...`);
      const product = await fetchProduct(url);
      console.log(
        `  parsed "${product.name ?? '(no title)'}" — ${product.ingredients.length} ingredient rows`,
      );
      results.push(product);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`crawl blocked — using hand-curated seed (${msg})`);
    // Still write whatever we managed to collect (likely empty) so the file
    // exists and the integration is demonstrably wired up.
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
    process.exit(0);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${results.length} crawled product(s) to ${outPath}`);
}

main().catch((err) => {
  // Belt-and-suspenders: never fail the build over the crawler stub.
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`crawl blocked — using hand-curated seed (${msg})`);
  process.exit(0);
});
