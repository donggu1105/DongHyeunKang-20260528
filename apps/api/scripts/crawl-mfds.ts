import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseBaseStandard,
  type ParsedIngredient,
} from '../src/ingest/parse-base-standard';

/**
 * 식약처(MFDS) 건강기능식품정보 크롤러 — "크롤링 연동"의 실동작 경로.
 *
 * iHerb 스텁(crawl-iherb.ts)이 anti-bot 403으로 막혔던 것과 달리, 식약처
 * 공공데이터 OpenAPI는 인증키로 한국 국내 건기식 실데이터를 합법·무제한
 * (개발계정 일 10,000건)으로 준다. 제품별 성분 함량은 BASE_STANDARD(기준규격)
 * 자유텍스트에 들어있어 parseBaseStandard()로 구조화한다.
 *
 * iHerb 스텁의 정직성 철학은 유지: 키 누락/네트워크/파싱 실패 시 명확히
 * 경고하고, 모은 만큼만 기록한 뒤 exit 0 — 손수 큐레이션한 seed
 * (prisma/seed/products.ts)가 여전히 source of truth다.
 *
 * 사용: pnpm crawl [검색어=어린이] [최대건수=30]
 */

const API_BASE =
  'http://apis.data.go.kr/1471000/HtfsInfoService03/getHtfsItem01';

interface CrawledProduct {
  source: string;
  statementNo: string | null;
  name: string | null;
  manufacturer: string | null;
  mainFunction: string | null;
  ingredients: ParsedIngredient[];
}

/** ts-node는 .env를 자동 로드하지 않으므로(NestJS와 달리) 직접 읽는다. */
function readServiceKey(): string | undefined {
  if (process.env.MFDS_SERVICE_KEY) return process.env.MFDS_SERVICE_KEY;
  try {
    const content = readFileSync(join(__dirname, '..', '.env'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*MFDS_SERVICE_KEY\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    /* .env 없음 — 무시 */
  }
  return undefined;
}

interface RawItem {
  PRDUCT?: string;
  ENTRPS?: string;
  STTEMNT_NO?: string;
  MAIN_FNCTN?: string;
  BASE_STANDARD?: string;
}

async function fetchPage(
  serviceKey: string,
  keyword: string,
  pageNo: number,
  numOfRows: number,
): Promise<{ total: number; items: RawItem[] }> {
  const url =
    `${API_BASE}?serviceKey=${serviceKey}` +
    `&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json` +
    `&Prduct=${encodeURIComponent(keyword)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { totalCount?: number; items?: { item: RawItem }[] };
  };
  if (data.header && data.header.resultCode !== '00') {
    throw new Error(`API ${data.header.resultCode}: ${data.header.resultMsg}`);
  }
  return {
    total: data.body?.totalCount ?? 0,
    items: (data.body?.items ?? []).map((w) => w.item),
  };
}

function toCrawledProduct(it: RawItem): CrawledProduct {
  return {
    source: 'MFDS HtfsInfoService03',
    statementNo: it.STTEMNT_NO ?? null,
    name: it.PRDUCT?.trim() ?? null,
    manufacturer: it.ENTRPS?.trim() ?? null,
    mainFunction: it.MAIN_FNCTN?.replace(/\s+/g, ' ').trim() ?? null,
    ingredients: parseBaseStandard(it.BASE_STANDARD),
  };
}

async function main() {
  const keyword = process.argv[2] ?? '어린이';
  const limit = Number(process.argv[3] ?? 30);
  const outDir = join(__dirname, '..', 'prisma', 'seed');
  const outPath = join(outDir, 'products.crawled.json');

  const serviceKey = readServiceKey();
  const results: CrawledProduct[] = [];

  try {
    if (!serviceKey) {
      throw new Error('MFDS_SERVICE_KEY 미설정 (.env 확인)');
    }
    console.log(`Fetching MFDS 건강기능식품 — 검색어 "${keyword}" ...`);
    // 한 페이지(최대 100건) 받아 성분이 파싱된 제품만 추린다.
    const { total, items } = await fetchPage(serviceKey, keyword, 1, 100);
    console.log(`  totalCount=${total}, 페이지 ${items.length}건 수신`);

    for (const it of items) {
      const product = toCrawledProduct(it);
      // 성분을 한 줄도 못 뽑은 제품(홍삼 지표성분 등)은 제외 — trust-checker가
      // 비교할 정량 데이터가 없으므로.
      if (product.ingredients.length === 0) continue;
      results.push(product);
      if (results.length >= limit) break;
    }
    console.log(
      `  성분 파싱 성공 ${results.length}건 (요청 상한 ${limit}) — ` +
        `평균 ${
          results.length
            ? (
                results.reduce((s, p) => s + p.ingredients.length, 0) /
                results.length
              ).toFixed(1)
            : 0
        }개 성분/제품`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`crawl skipped — using hand-curated seed (${msg})`);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
    process.exit(0);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${results.length} crawled product(s) to ${outPath}`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`crawl skipped — using hand-curated seed (${msg})`);
  process.exit(0);
});
