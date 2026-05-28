import type { PrismaClient } from '@prisma/client';

/**
 * Demo product seed.
 *
 * These are REPRESENTATIVE demo values (대표값/시연용) used to exercise the
 * analysis pipeline end-to-end. They are NOT crawled label data — the
 * `sourceUrl` is tagged accordingly so they are never mistaken for real,
 * citable facts. Units are written as they appear on labels ('IU', 'mg',
 * '㎍', '억CFU'); `amountCanonical` is left null and the rule engine
 * normalizes at runtime.
 */

export const DEMO_SOURCE_URL = 'demo seed — 대표값(시연용)';

export interface ProductIngredientSeed {
  ingredientName: string;
  amount: number;
  unit: string;
}

export interface ProductSeed {
  name: string;
  brand: string;
  form: string;
  targetAgeLabel: string;
  ingredients: ProductIngredientSeed[];
}

export const PRODUCTS: ProductSeed[] = [
  {
    name: '키즈 종합비타민 구미',
    brand: '노바',
    form: '구미',
    targetAgeLabel: '3세 이상',
    ingredients: [
      { ingredientName: '비타민A', amount: 200, unit: '㎍' },
      { ingredientName: '비타민C', amount: 30, unit: 'mg' },
      { ingredientName: '비타민D', amount: 400, unit: 'IU' },
      { ingredientName: '비타민E', amount: 5, unit: 'mg' },
      { ingredientName: '아연', amount: 2, unit: 'mg' },
    ],
  },
  {
    name: '비타민D 드롭',
    brand: '베이비D',
    form: '액상',
    targetAgeLabel: '전연령',
    ingredients: [{ ingredientName: '비타민D', amount: 400, unit: 'IU' }],
  },
  {
    name: '비타민D3 구미 고함량',
    brand: '선샤인',
    form: '구미',
    targetAgeLabel: '4세 이상',
    ingredients: [{ ingredientName: '비타민D', amount: 1000, unit: 'IU' }],
  },
  {
    name: '프로바이오틱스 키즈',
    brand: '락토',
    form: '분말',
    targetAgeLabel: '1세 이상',
    ingredients: [{ ingredientName: '유산균', amount: 100, unit: '억CFU' }],
  },
  {
    name: '칼슘 마그네슘 츄어블',
    brand: '본스',
    form: '정제',
    targetAgeLabel: '6세 이상',
    ingredients: [{ ingredientName: '칼슘', amount: 300, unit: 'mg' }],
  },
  {
    name: '철분 시럽',
    brand: '아이언키즈',
    form: '액상',
    targetAgeLabel: '1세 이상',
    ingredients: [{ ingredientName: '철', amount: 5, unit: 'mg' }],
  },
  {
    name: '비타민C 츄어블',
    brand: '씨푸드',
    form: '정제',
    targetAgeLabel: '3세 이상',
    ingredients: [{ ingredientName: '비타민C', amount: 100, unit: 'mg' }],
  },
  {
    name: '면역 구미',
    brand: '이뮨',
    form: '구미',
    targetAgeLabel: '3세 이상',
    ingredients: [
      { ingredientName: '비타민C', amount: 60, unit: 'mg' },
      { ingredientName: '아연', amount: 3, unit: 'mg' },
      { ingredientName: '비타민D', amount: 600, unit: 'IU' },
    ],
  },
  {
    name: '종합비타민 시럽',
    brand: '키득',
    form: '액상',
    targetAgeLabel: '전연령',
    ingredients: [
      { ingredientName: '비타민A', amount: 150, unit: '㎍' },
      { ingredientName: '비타민C', amount: 25, unit: 'mg' },
      { ingredientName: '비타민D', amount: 200, unit: 'IU' },
    ],
  },
];

export interface SeedProductsResult {
  products: number;
  productIngredients: number;
}

/**
 * Creates each demo product with its nested ProductIngredient rows. Looks up
 * ingredientId by name (ingredients must already be seeded). Throws a clear
 * error if a product references an unknown ingredient name.
 *
 * NOTE: callers are expected to have already cleared `product` /
 * `productIngredient` (see seed.ts FK-safe order).
 */
export async function seedProducts(
  prisma: PrismaClient,
): Promise<SeedProductsResult> {
  const ingredients = await prisma.ingredient.findMany({
    select: { id: true, name: true },
  });
  const idByName = new Map(ingredients.map((i) => [i.name, i.id]));

  let productIngredients = 0;

  for (const product of PRODUCTS) {
    const create = product.ingredients.map((pi) => {
      const ingredientId = idByName.get(pi.ingredientName);
      if (ingredientId === undefined) {
        throw new Error(
          `Product "${product.name}" references unknown ingredient "${pi.ingredientName}". ` +
            `Seed ingredients (standards) before products.`,
        );
      }
      return {
        ingredientId,
        amount: pi.amount,
        unit: pi.unit,
        // amountCanonical intentionally null: normalized by the rule engine.
      };
    });

    await prisma.product.create({
      data: {
        name: product.name,
        brand: product.brand,
        form: product.form,
        targetAgeLabel: product.targetAgeLabel,
        sourceUrl: DEMO_SOURCE_URL,
        ingredients: { create },
      },
    });
    productIngredients += create.length;
  }

  return { products: PRODUCTS.length, productIngredients };
}
