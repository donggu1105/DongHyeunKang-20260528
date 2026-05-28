// 룰 엔진이 다루는 plain 타입 (Prisma 모델과 분리 — service 경계에서 매핑)
export type VerdictCode = 'SAFE' | 'DUPLICATE' | 'OVER' | 'UNKNOWN';
export type Sex = 'MALE' | 'FEMALE';

export type IngredientDef = {
  id: number;
  name: string;
  canonicalUnit: string; // 이 성분의 기준 단위 (예: 비타민D → "㎍")
  isFatSoluble: boolean;
};

export type LabeledAmount = {
  ingredientId: number;
  amount: number; // 라벨 표기값
  unit: string; // 라벨 표기 단위 (mg / IU / ㎍ ...)
};

export type ProductInput = {
  productId: number;
  name: string;
  amounts: LabeledAmount[];
};

export type ReferenceDef = {
  ingredientId: number;
  ageMinMonths: number;
  ageMaxMonths: number;
  sex: Sex | null; // null = 남녀 공통
  recommended: number | null; // RDA/AI
  upperLimit: number | null; // UL (상한)
  unit: string; // canonicalUnit과 동일해야 함
  source: string;
  sourceUrl: string | null;
};

export type NutrientResult = {
  ingredientId: number;
  totalCanonical: number | null; // 정규화 실패 시 null → UNKNOWN
  unit: string;
  productCount: number; // 이 성분이 등장한 제품 수 (중복 판정용)
  recommended: number | null;
  upperLimit: number | null;
  percentOfRecommended: number | null;
  verdict: VerdictCode;
  reference: ReferenceDef | null;
};
