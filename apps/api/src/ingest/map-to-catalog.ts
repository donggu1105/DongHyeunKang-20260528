import type { ParsedIngredient } from './parse-base-standard';

/**
 * 크롤된 성분(parseBaseStandard 결과)을 분석 엔진의 캐논 카탈로그에 매핑한다.
 *
 * 분석 엔진은 KDRIs 기준을 가진 캐논 성분 8종(standards.ts STANDARDS)만 안다.
 * 크롤 데이터엔 마그네슘·나이아신·B군·엽산 등 기준 없는 성분이 섞여 오므로,
 * 캐논에 해당하는 것만 남기고 나머지는 버린다(trust-checker 범위 밖).
 *
 * 단위는 엔진 units.ts(toCanonical)가 받는 형태로 환원한다:
 *   - 영양 접미사 제거: "㎍ RAE"→"㎍", "mg α-TE"→"mg" (공백 앞 base만 사용)
 *   - 유산균: 크롤 "… CFU"(절대 수) → 데모 컨벤션 "억CFU"(÷1e8)
 * (마이크로그램 글리프는 parseBaseStandard가 이미 "㎍"로 정규화한 상태.)
 */

// standards.ts의 STANDARDS와 반드시 일치해야 한다.
const CANONICAL = new Set([
  '비타민D',
  '비타민A',
  '비타민C',
  '비타민E',
  '칼슘',
  '철',
  '아연',
  '유산균',
]);

// 크롤 표기 → 캐논 성분명 별칭
const ALIAS: Record<string, string> = {
  프로바이오틱스수: '유산균',
  프로바이오틱스: '유산균',
};

export interface CatalogIngredient {
  /** 캐논 성분명 (CANONICAL 중 하나) */
  ingredientName: string;
  /** 라벨 표기값 (유산균은 억CFU로 환산됨) */
  amount: number;
  /** 엔진 toCanonical이 받는 단위: "mg" | "㎍" | "g" | "억CFU" */
  unit: string;
}

/** 성분 하나를 캐논으로 매핑. 캐논 밖이면 null. */
export function mapIngredient(p: ParsedIngredient): CatalogIngredient | null {
  const name = ALIAS[p.name] ?? p.name;
  if (!CANONICAL.has(name)) return null;

  const base = p.unit.split(' ')[0]; // "㎍ RAE" → "㎍", "mg α-TE" → "mg"

  if (name === '유산균' || base === 'CFU') {
    // 절대 CFU 수 → 억CFU (1억 = 1e8). 기준이 없어 검증은 UNKNOWN이지만 표기 일관성.
    return { ingredientName: '유산균', amount: p.amount / 1e8, unit: '억CFU' };
  }
  return { ingredientName: name, amount: p.amount, unit: base };
}

/**
 * 한 제품의 성분 배열을 캐논 카탈로그로 매핑. 캐논 밖 성분은 제외하고,
 * 같은 캐논 성분이 중복되면 첫 값만 남긴다(@@unique[productId,ingredientId] 보호).
 */
export function mapProductIngredients(
  ingredients: ParsedIngredient[],
): CatalogIngredient[] {
  const out: CatalogIngredient[] = [];
  const seen = new Set<string>();
  for (const ing of ingredients) {
    const m = mapIngredient(ing);
    if (!m || seen.has(m.ingredientName)) continue;
    seen.add(m.ingredientName);
    out.push(m);
  }
  return out;
}
