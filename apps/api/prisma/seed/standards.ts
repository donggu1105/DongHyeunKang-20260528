import type { Prisma, PrismaClient } from '@prisma/client';

/** Accepts both a full PrismaClient and an interactive-transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * KDRIs 2020 (보건복지부·한국영양학회) standards seed.
 *
 * SAFETY-CRITICAL: do NOT alter these numbers. They are sourced from
 * 2020 한국인 영양소 섭취기준 (KDRIs). Where KDRIs splits the RDA/AI by sex,
 * we store the LOWER of the two sex values as `recommended` (conservative:
 * a lower recommended threshold makes "부족" judgments stricter and never
 * understates a deficiency). The upper limit (UL) is sex-common, so it is
 * the safety-critical number and is used as-is. All rows use `sex: null`
 * (applies to both) because we collapse the sex split into a single
 * conservative row.
 */

export const SOURCE = 'KDRIs 2020 (보건복지부·한국영양학회)';
export const SOURCE_URL =
  'https://www.kns.or.kr/FileRoom/FileRoom_view.asp?idx=108&BoardID=Kdr';

export interface IngredientSeed {
  name: string;
  canonicalUnit: string;
  isFatSoluble: boolean;
}

/**
 * One intake-reference band. `recommended` = RDA or AI (lower-sex where the
 * KDRIs table splits by sex); `upperLimit` = UL (상한섭취량, sex-common).
 * Either may be null when KDRIs does not define it.
 */
export interface ReferenceBand {
  ageMinMonths: number;
  ageMaxMonths: number;
  recommended: number | null;
  upperLimit: number | null;
}

export interface IngredientStandard {
  ingredient: IngredientSeed;
  /** Empty array => no KDRIs reference (rule engine treats as UNKNOWN). */
  references: ReferenceBand[];
}

/**
 * [min, max, recommended, upperLimit] tuples mirror the spec exactly so the
 * numbers stay auditable at a glance.
 */
const band = (
  ageMinMonths: number,
  ageMaxMonths: number,
  recommended: number | null,
  upperLimit: number | null,
): ReferenceBand => ({ ageMinMonths, ageMaxMonths, recommended, upperLimit });

export const STANDARDS: IngredientStandard[] = [
  {
    // 비타민D (AI). recommended = AI (sex-common).
    ingredient: { name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true },
    references: [
      band(12, 35, 5, 30),
      band(36, 71, 5, 35),
      band(72, 107, 5, 40),
      band(108, 143, 5, 60),
      band(144, 179, 10, 100),
      band(180, 227, 10, 100),
    ],
  },
  {
    // 비타민A (RDA, RAE). recommended = lower-sex value where split.
    ingredient: { name: '비타민A', canonicalUnit: '㎍', isFatSoluble: true },
    references: [
      band(12, 35, 250, 600),
      band(36, 71, 300, 750),
      band(72, 107, 400, 1100), // lower-sex = 400
      band(108, 143, 550, 1600), // lower-sex = 550
      band(144, 179, 650, 2300),
      band(180, 227, 650, 2800),
    ],
  },
  {
    // 비타민C (RDA).
    ingredient: { name: '비타민C', canonicalUnit: 'mg', isFatSoluble: false },
    references: [
      band(12, 35, 40, 340),
      band(36, 71, 45, 510),
      band(72, 107, 50, 750),
      band(108, 143, 70, 1100),
      band(144, 179, 90, 1400),
      band(180, 227, 100, 1600),
    ],
  },
  {
    // 비타민E (AI). recommended = AI (sex-common).
    ingredient: { name: '비타민E', canonicalUnit: 'mg', isFatSoluble: true },
    references: [
      band(12, 35, 5, 100),
      band(36, 71, 6, 150),
      band(72, 107, 7, 200),
      band(108, 143, 9, 300),
      band(144, 179, 11, 400),
      band(180, 227, 12, 500),
    ],
  },
  {
    // 칼슘 (RDA). recommended = lower-sex value where split.
    ingredient: { name: '칼슘', canonicalUnit: 'mg', isFatSoluble: false },
    references: [
      band(12, 35, 500, 2500),
      band(36, 71, 600, 2500),
      band(72, 107, 700, 2500),
      band(108, 143, 800, 3000),
      band(144, 179, 900, 3000), // lower-sex = 900
      band(180, 227, 800, 3000), // lower-sex = 800
    ],
  },
  {
    // 철 (RDA). recommended = lower-sex value where split.
    ingredient: { name: '철', canonicalUnit: 'mg', isFatSoluble: false },
    references: [
      band(12, 35, 6, 40),
      band(36, 71, 7, 40),
      band(72, 107, 9, 40),
      band(108, 143, 10, 40), // lower-sex = 10
      band(144, 179, 14, 40), // lower-sex = 14
      band(180, 227, 14, 45),
    ],
  },
  {
    // 아연 (RDA). recommended = lower-sex value where split.
    ingredient: { name: '아연', canonicalUnit: 'mg', isFatSoluble: false },
    references: [
      band(12, 35, 3, 6),
      band(36, 71, 4, 9),
      band(72, 107, 5, 13),
      band(108, 143, 8, 19),
      band(144, 179, 8, 27),
      band(180, 227, 9, 33), // lower-sex = 9
    ],
  },
  {
    // 유산균: KDRIs has no UL/RDA → no reference rows. Rule engine reports
    // UNKNOWN ("확인 불가") for this ingredient.
    ingredient: { name: '유산균', canonicalUnit: '억CFU', isFatSoluble: false },
    references: [],
  },
];

export interface SeedStandardsResult {
  ingredients: number;
  references: number;
}

/**
 * Upserts the 8 ingredients by unique name (never deletes ingredients, to
 * avoid cascading AnalysisResult rows) and recreates their intake references.
 *
 * NOTE: callers are expected to have already cleared `intakeReference` (see
 * seed.ts FK-safe order). We only upsert ingredients and createMany the
 * references here.
 */
export async function seedStandards(
  prisma: Db,
): Promise<SeedStandardsResult> {
  // Upsert ingredients by unique name; capture id by name for references.
  const idByName = new Map<string, number>();
  for (const { ingredient } of STANDARDS) {
    const row = await prisma.ingredient.upsert({
      where: { name: ingredient.name },
      create: {
        name: ingredient.name,
        canonicalUnit: ingredient.canonicalUnit,
        isFatSoluble: ingredient.isFatSoluble,
      },
      update: {
        canonicalUnit: ingredient.canonicalUnit,
        isFatSoluble: ingredient.isFatSoluble,
      },
    });
    idByName.set(ingredient.name, row.id);
  }

  // Build all reference rows. unit = the ingredient's canonicalUnit.
  const referenceRows = STANDARDS.flatMap(({ ingredient, references }) => {
    const ingredientId = idByName.get(ingredient.name)!;
    return references.map((b) => ({
      ingredientId,
      ageMinMonths: b.ageMinMonths,
      ageMaxMonths: b.ageMaxMonths,
      sex: null,
      recommended: b.recommended,
      upperLimit: b.upperLimit,
      unit: ingredient.canonicalUnit,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
    }));
  });

  const created = await prisma.intakeReference.createMany({
    data: referenceRows,
  });

  return { ingredients: STANDARDS.length, references: created.count };
}
