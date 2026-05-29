import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { mapProductIngredients } from '../../src/ingest/map-to-catalog';
import type { ParsedIngredient } from '../../src/ingest/parse-base-standard';

/**
 * 식약처 크롤 산출물(products.crawled.json, `pnpm crawl`)을 DB 카탈로그에
 * 반영한다. 데모 seed(products.ts)에 ADDITIVE — 손수 큐레이션한 제품은 그대로
 * 두고, 실제 식약처 제품을 추가로 등록한다.
 *
 * 산출물 파일은 gitignored이고 크롤을 안 돌리면 없을 수 있다. 그 경우 조용히
 * 건너뛴다 — seed는 크롤러 없이도 동작해야 한다(seed가 source of truth).
 *
 * 성분은 map-to-catalog가 캐논 8종으로 매핑(나머지는 제외)하고, 캐논 성분이
 * 하나도 없는 제품(예: 홍삼·B군 전용)은 분석할 게 없으므로 등록하지 않는다.
 */

interface CrawledProduct {
  source: string;
  statementNo: string | null;
  name: string | null;
  manufacturer: string | null;
  mainFunction: string | null;
  ingredients: ParsedIngredient[];
}

export interface SeedCrawledResult {
  products: number;
  productIngredients: number;
}

export async function seedCrawledProducts(
  prisma: PrismaClient,
): Promise<SeedCrawledResult> {
  const path = join(__dirname, 'products.crawled.json');
  if (!existsSync(path)) {
    console.log('  crawled(식약처): 산출물 없음 — 건너뜀 (pnpm crawl 미실행)');
    return { products: 0, productIngredients: 0 };
  }

  const crawled = JSON.parse(readFileSync(path, 'utf8')) as CrawledProduct[];

  const ingredients = await prisma.ingredient.findMany({
    select: { id: true, name: true },
  });
  const idByName = new Map(ingredients.map((i) => [i.name, i.id]));

  let products = 0;
  let productIngredients = 0;

  for (const cp of crawled) {
    const mapped = mapProductIngredients(cp.ingredients);
    if (mapped.length === 0) continue; // 캐논 성분 0개 → 분석 불가, 등록 안 함

    const create = mapped.map((m) => {
      const ingredientId = idByName.get(m.ingredientName);
      if (ingredientId === undefined) {
        throw new Error(
          `Crawled product "${cp.name}" mapped to unknown ingredient "${m.ingredientName}".`,
        );
      }
      return { ingredientId, amount: m.amount, unit: m.unit };
    });

    await prisma.product.create({
      data: {
        name: cp.name ?? '(이름 없음)',
        brand: cp.manufacturer ?? null,
        sourceUrl: `식약처 건강기능식품정보 · 신고번호 ${cp.statementNo ?? '-'}`,
        ingredients: { create },
      },
    });
    products += 1;
    productIngredients += create.length;
  }

  console.log(
    `  crawled(식약처): products=${products}, productIngredients=${productIngredients}`,
  );
  return { products, productIngredients };
}
