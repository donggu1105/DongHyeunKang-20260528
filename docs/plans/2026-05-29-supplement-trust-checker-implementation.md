# 우리 아이 영양제 신뢰 체커 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 엄마가 아이 나이 + (장바구니에 담은) 어린이 영양제를 넣으면, 성분 중복·과다를 연령 기준으로 근거·출처와 함께 검증해 주는 MVP를 NestJS API + Next.js 프론트로 구현하고 배포한다.

**Architecture:** 결정론적 룰 엔진(순수 TS 함수)이 단위 정규화·합산·상한(UL) 비교로 **판정**을 내리고, LLM은 그 판정을 **설명**만 한다(계산엔 관여 안 함). 근거(grounding)는 `IntakeReference` 테이블의 구조화된 KDRIs 인용을 lookup해서 댄다. 입력은 seed 카탈로그에서만 선택(자유입력·LLM 추출 없음).

**Tech Stack:** NestJS 11 + Prisma 6 + Supabase Postgres / Next.js 16(App Router) / OpenAI(설명 생성) / Jest(ts-jest) / pnpm + Turborepo.

**설계 문서:** `docs/plans/2026-05-29-supplement-trust-checker-design.md`

**⚠️ 설계 대비 변경점 (실행 전 확인):**
- 설계 §8은 "Supabase + pgvector(기준문서 RAG)"였으나, 커밋된 `schema.prisma`의 `IntakeReference`가 이미 `source`/`sourceUrl` 인용 필드를 가진 **구조화 테이블**이라, 코어 grounding은 **구조화 lookup**으로 구현한다(더 정확·결정론적, 30개 규모에 벡터검색은 과함). pgvector RAG는 **Phase H(옵션)** 로 분리.
- `schema.prisma`는 이미 완성됨 → 데이터 모델 신규 설계 없음. Verdict enum = `SAFE | DUPLICATE | OVER | UNKNOWN`, 나이는 `ageMonths` 기준.

---

## 진행 원칙
- **@superpowers:test-driven-development** 준수: 실패하는 테스트 → 최소 구현 → 통과 → 커밋.
- 룰 엔진은 **Prisma에서 분리된 순수 함수**(plain interface 입력)로 작성 → DB 없이 단위 테스트 가능. 매핑은 service 경계에서.
- 커밋은 작게 자주. 안전 제품이므로 **계산 정확성 > 기능 수**.
- API 테스트 실행: `pnpm --filter @levit/api test -- <패턴>` (jest path 패턴).

---

## Phase A — 의존성 & DB 준비

### Task A1: OpenAI 의존성 추가 + env 키 선언

**Files:**
- Modify: `apps/api/package.json` (dependencies)
- Modify: `apps/api/.env.example`

**Step 1: openai 설치**
```bash
pnpm --filter @levit/api add openai
```

**Step 2: `.env.example`에 키 추가** (맨 아래에 덧붙임)
```bash
# --- OpenAI (설명 생성 전용. 계산엔 사용 안 함) ---
OPENAI_API_KEY="sk-..."
```

**Step 3: 커밋**
```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/.env.example ../../pnpm-lock.yaml
git commit -m "chore(api): add openai dep + OPENAI_API_KEY env"
```

### Task A2: 스키마를 DB에 push + Prisma client 생성

> 전제: `apps/api/.env`에 유효한 `DATABASE_URL`/`DIRECT_URL`(Supabase)이 있어야 함. 없으면 실행자가 먼저 채운다 (`! cp apps/api/.env.example apps/api/.env` 후 값 입력).

**Step 1: push + generate**
```bash
make db-push      # = prisma db push (schema → Supabase)
make generate     # = prisma generate
```
Expected: `Your database is now in sync with your Prisma schema.` + client 생성 로그.

**Step 2: 테이블 확인** (선택, supabase MCP 사용 가능 시)
`list_tables`로 `Product, Ingredient, ProductIngredient, IntakeReference, Analysis, AnalysisResult ...` 존재 확인.

**Step 3: 커밋** (스키마 변경 없으면 생략. push는 코드 변경 아님)

---

## Phase B — 룰 계산 코어 (순수 함수, TDD) ★ 제품의 심장

새 디렉토리: `apps/api/src/analysis/rules/`. 모든 함수는 Prisma 비의존 순수 함수.

### Task B0: 공용 타입 정의 (테스트 없음, 타입만)

**Files:**
- Create: `apps/api/src/analysis/analysis.types.ts`

```typescript
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
```

### Task B1: 단위 정규화 `units.ts`

**Files:**
- Create: `apps/api/src/analysis/rules/units.spec.ts`
- Create: `apps/api/src/analysis/rules/units.ts`

**Step 1: 실패 테스트 작성** (`units.spec.ts`)
```typescript
import { toCanonical } from './units';

describe('toCanonical', () => {
  const vitD = { id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true };
  const vitC = { id: 2, name: '비타민C', canonicalUnit: 'mg', isFatSoluble: false };

  it('passes through same unit', () => {
    expect(toCanonical(10, 'mg', vitC)).toBe(10);
  });

  it('converts mcg/㎍/ug to the canonical mass', () => {
    expect(toCanonical(1000, 'mcg', vitC)).toBe(1); // 1000mcg = 1mg
    expect(toCanonical(500, '㎍', vitC)).toBe(0.5);
    expect(toCanonical(2000, 'ug', vitC)).toBe(2);
  });

  it('converts IU to ㎍ for vitamin D (1 IU = 0.025㎍)', () => {
    expect(toCanonical(400, 'IU', vitD)).toBeCloseTo(10, 5); // 400 IU = 10㎍
  });

  it('returns null for an unknown / unconvertible unit', () => {
    expect(toCanonical(5, 'spoons', vitC)).toBeNull();
  });
});
```

**Step 2: 실패 확인**
Run: `pnpm --filter @levit/api test -- units.spec`
Expected: FAIL — `Cannot find module './units'`.

**Step 3: 최소 구현** (`units.ts`)
```typescript
import type { IngredientDef } from '../analysis.types';

// 질량 단위 → mg 환산
const MASS_TO_MG: Record<string, number> = {
  g: 1000, mg: 1, mcg: 0.001, '㎍': 0.001, ug: 0.001, µg: 0.001,
};

// IU → canonical 단위 환산 (성분별로 다름). 키는 성분명.
const IU_TO_CANONICAL: Record<string, { unit: string; factor: number }> = {
  비타민D: { unit: '㎍', factor: 0.025 }, // 1 IU = 0.025㎍
  비타민A: { unit: '㎍', factor: 0.3 }, // 1 IU = 0.3㎍ RAE
  비타민E: { unit: 'mg', factor: 0.667 }, // 1 IU = 0.667mg (natural)
};

/** 라벨 표기값을 성분의 canonicalUnit 기준 숫자로 변환. 불가능하면 null. */
export function toCanonical(amount: number, unit: string, ing: IngredientDef): number | null {
  const u = unit.trim();
  if (u === 'IU') {
    const conv = IU_TO_CANONICAL[ing.name];
    if (!conv || conv.unit !== ing.canonicalUnit) return null;
    return amount * conv.factor;
  }
  // 질량 단위: 라벨 단위 → mg → canonical 단위
  const labelToMg = MASS_TO_MG[u];
  const canonToMg = MASS_TO_MG[ing.canonicalUnit];
  if (labelToMg === undefined || canonToMg === undefined) return null;
  return (amount * labelToMg) / canonToMg;
}
```

**Step 4: 통과 확인**
Run: `pnpm --filter @levit/api test -- units.spec` → Expected: PASS.

**Step 5: 커밋**
```bash
git add apps/api/src/analysis/analysis.types.ts apps/api/src/analysis/rules/units.*
git commit -m "feat(api): unit normalization rule (mass + IU, ingredient-specific)"
```

### Task B2: 연령·성별 기준 선택 `reference.ts`

**Files:**
- Create: `apps/api/src/analysis/rules/reference.spec.ts`
- Create: `apps/api/src/analysis/rules/reference.ts`

**Step 1: 실패 테스트**
```typescript
import { selectReference } from './reference';
import type { ReferenceDef } from '../analysis.types';

const refs: ReferenceDef[] = [
  { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: 5, upperLimit: 40, unit: '㎍', source: 'KDRIs 2020', sourceUrl: null },
  { ingredientId: 1, ageMinMonths: 108, ageMaxMonths: 143, sex: null, recommended: 5, upperLimit: 60, unit: '㎍', source: 'KDRIs 2020', sourceUrl: null },
];

describe('selectReference', () => {
  it('picks the band containing the age in months', () => {
    expect(selectReference(refs, 96, null)?.upperLimit).toBe(40); // 8세
    expect(selectReference(refs, 120, null)?.upperLimit).toBe(60); // 10세
  });
  it('returns null when no band matches', () => {
    expect(selectReference(refs, 12, null)).toBeNull();
  });
  it('prefers a sex-specific band over a null-sex band when sex given', () => {
    const withSex: ReferenceDef[] = [
      { ...refs[0], sex: null, upperLimit: 40 },
      { ...refs[0], sex: 'FEMALE', upperLimit: 35 },
    ];
    expect(selectReference(withSex, 96, 'FEMALE')?.upperLimit).toBe(35);
  });
});
```

**Step 2: 실패 확인** → `pnpm --filter @levit/api test -- reference.spec` → FAIL.

**Step 3: 구현**
```typescript
import type { ReferenceDef, Sex } from '../analysis.types';

export function selectReference(refs: ReferenceDef[], ageMonths: number, sex: Sex | null): ReferenceDef | null {
  const inBand = refs.filter((r) => ageMonths >= r.ageMinMonths && ageMonths <= r.ageMaxMonths);
  if (inBand.length === 0) return null;
  if (sex) {
    const exact = inBand.find((r) => r.sex === sex);
    if (exact) return exact;
  }
  return inBand.find((r) => r.sex === null) ?? inBand[0];
}
```

**Step 4: 통과 확인** → PASS.

**Step 5: 커밋**
```bash
git add apps/api/src/analysis/rules/reference.*
git commit -m "feat(api): age/sex-banded intake reference selection"
```

### Task B3: 성분별 합산 `aggregate.ts`

**Files:**
- Create: `apps/api/src/analysis/rules/aggregate.spec.ts`
- Create: `apps/api/src/analysis/rules/aggregate.ts`

**Step 1: 실패 테스트**
```typescript
import { aggregateByIngredient } from './aggregate';
import type { IngredientDef, ProductInput } from '../analysis.types';

const vitD: IngredientDef = { id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true };
const ings = new Map<number, IngredientDef>([[1, vitD]]);

const products: ProductInput[] = [
  { productId: 10, name: 'A', amounts: [{ ingredientId: 1, amount: 10, unit: '㎍' }] },
  { productId: 11, name: 'B', amounts: [{ ingredientId: 1, amount: 15, unit: '㎍' }] },
];

describe('aggregateByIngredient', () => {
  it('sums canonical amounts and counts products', () => {
    const out = aggregateByIngredient(products, ings);
    expect(out.get(1)).toEqual({ totalCanonical: 25, productCount: 2 });
  });
  it('marks total null when any amount fails to normalize', () => {
    const bad: ProductInput[] = [{ productId: 12, name: 'C', amounts: [{ ingredientId: 1, amount: 5, unit: 'spoons' }] }];
    expect(aggregateByIngredient(bad, ings).get(1)).toEqual({ totalCanonical: null, productCount: 1 });
  });
});
```

**Step 2: 실패 확인** → FAIL.

**Step 3: 구현**
```typescript
import type { IngredientDef, ProductInput } from '../analysis.types';
import { toCanonical } from './units';

export type AggRow = { totalCanonical: number | null; productCount: number };

export function aggregateByIngredient(
  products: ProductInput[],
  ingredients: Map<number, IngredientDef>,
): Map<number, AggRow> {
  const out = new Map<number, AggRow>();
  for (const p of products) {
    for (const a of p.amounts) {
      const ing = ingredients.get(a.ingredientId);
      const prev = out.get(a.ingredientId) ?? { totalCanonical: 0, productCount: 0 };
      const conv = ing ? toCanonical(a.amount, a.unit, ing) : null;
      out.set(a.ingredientId, {
        totalCanonical: prev.totalCanonical === null || conv === null ? null : prev.totalCanonical + conv,
        productCount: prev.productCount + 1,
      });
    }
  }
  return out;
}
```

**Step 4: 통과 확인** → PASS.

**Step 5: 커밋**
```bash
git add apps/api/src/analysis/rules/aggregate.*
git commit -m "feat(api): sum ingredients across products (null on unconvertible)"
```

### Task B4: 판정 `verdict.ts` — ★ 거짓경보 금지 로직

**Files:**
- Create: `apps/api/src/analysis/rules/verdict.spec.ts`
- Create: `apps/api/src/analysis/rules/verdict.ts`

**Step 1: 실패 테스트**
```typescript
import { judge } from './verdict';
import type { ReferenceDef } from '../analysis.types';

const ref: ReferenceDef = { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: 5, upperLimit: 40, unit: '㎍', source: 'KDRIs 2020', sourceUrl: null };

describe('judge', () => {
  it('UNKNOWN when no reference', () => {
    expect(judge(25, 2, null).verdict).toBe('UNKNOWN');
  });
  it('UNKNOWN when total is null (normalization failed)', () => {
    expect(judge(null, 1, ref).verdict).toBe('UNKNOWN');
  });
  it('OVER only when total exceeds the upper limit', () => {
    expect(judge(41, 1, ref).verdict).toBe('OVER');
  });
  it('DUPLICATE when in >=2 products but still within UL (거짓경보 금지)', () => {
    const r = judge(25, 2, ref); // 25㎍ = 권장5의 500% 이지만 UL 40 이내
    expect(r.verdict).toBe('DUPLICATE');
    expect(r.percentOfRecommended).toBe(500); // 높은 %는 정보일 뿐, OVER 아님
  });
  it('SAFE when single product and within UL', () => {
    expect(judge(5, 1, ref).verdict).toBe('SAFE');
  });
});
```

**Step 2: 실패 확인** → FAIL.

**Step 3: 구현**
```typescript
import type { ReferenceDef, VerdictCode } from '../analysis.types';

export type Judgement = { verdict: VerdictCode; percentOfRecommended: number | null };

export function judge(total: number | null, productCount: number, ref: ReferenceDef | null): Judgement {
  if (ref === null || total === null) return { verdict: 'UNKNOWN', percentOfRecommended: null };
  const pct = ref.recommended ? Math.round((total / ref.recommended) * 100) : null;
  if (ref.upperLimit !== null && total > ref.upperLimit) return { verdict: 'OVER', percentOfRecommended: pct };
  if (productCount >= 2) return { verdict: 'DUPLICATE', percentOfRecommended: pct };
  return { verdict: 'SAFE', percentOfRecommended: pct };
}
```

**Step 4: 통과 확인** → PASS.

**Step 5: 커밋**
```bash
git add apps/api/src/analysis/rules/verdict.*
git commit -m "feat(api): verdict rule — OVER only above UL, high %RDA stays DUPLICATE (no false alarm)"
```

### Task B5: 순수 오케스트레이터 `analyze.ts`

**Files:**
- Create: `apps/api/src/analysis/rules/analyze.spec.ts`
- Create: `apps/api/src/analysis/rules/analyze.ts`

**Step 1: 실패 테스트**
```typescript
import { runAnalysis } from './analyze';
import type { IngredientDef, ProductInput, ReferenceDef } from '../analysis.types';

const vitD: IngredientDef = { id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true };
const refs: ReferenceDef[] = [
  { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: 5, upperLimit: 40, unit: '㎍', source: 'KDRIs 2020', sourceUrl: 'http://x' },
];
const products: ProductInput[] = [
  { productId: 10, name: 'A', amounts: [{ ingredientId: 1, amount: 400, unit: 'IU' }] }, // 10㎍
  { productId: 11, name: 'B', amounts: [{ ingredientId: 1, amount: 15, unit: '㎍' }] },
];

it('produces a grounded per-nutrient result', () => {
  const out = runAnalysis({ ageMonths: 96, sex: null, products, ingredients: [vitD], references: refs });
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({
    ingredientId: 1, totalCanonical: 25, productCount: 2,
    verdict: 'DUPLICATE', percentOfRecommended: 500,
  });
  expect(out[0].reference?.source).toBe('KDRIs 2020');
});
```

**Step 2: 실패 확인** → FAIL.

**Step 3: 구현**
```typescript
import type { IngredientDef, NutrientResult, ProductInput, ReferenceDef, Sex } from '../analysis.types';
import { aggregateByIngredient } from './aggregate';
import { selectReference } from './reference';
import { judge } from './verdict';

export type AnalysisInput = {
  ageMonths: number;
  sex: Sex | null;
  products: ProductInput[];
  ingredients: IngredientDef[];
  references: ReferenceDef[];
};

export function runAnalysis(input: AnalysisInput): NutrientResult[] {
  const ingMap = new Map(input.ingredients.map((i) => [i.id, i]));
  const agg = aggregateByIngredient(input.products, ingMap);
  const results: NutrientResult[] = [];
  for (const [ingredientId, row] of agg) {
    const ing = ingMap.get(ingredientId);
    const refsFor = input.references.filter((r) => r.ingredientId === ingredientId);
    const ref = selectReference(refsFor, input.ageMonths, input.sex);
    const j = judge(row.totalCanonical, row.productCount, ref);
    results.push({
      ingredientId,
      totalCanonical: row.totalCanonical,
      unit: ing?.canonicalUnit ?? '',
      productCount: row.productCount,
      recommended: ref?.recommended ?? null,
      upperLimit: ref?.upperLimit ?? null,
      percentOfRecommended: j.percentOfRecommended,
      verdict: j.verdict,
      reference: ref,
    });
  }
  return results;
}
```

**Step 4: 통과 확인** → PASS. 이 시점에서 **계산 코어 완성**.

**Step 5: 커밋**
```bash
git add apps/api/src/analysis/rules/analyze.*
git commit -m "feat(api): pure analysis orchestrator (aggregate→reference→judge)"
```

---

## Phase C — `/analyze` 엔드포인트 (NestJS + Prisma)

### Task C1: DTO + Prisma→plain 매퍼 + Service (설명은 mock)

**Files:**
- Create: `apps/api/src/analysis/dto/analyze.dto.ts`
- Create: `apps/api/src/analysis/analysis.service.ts`
- Create: `apps/api/src/analysis/analysis.service.spec.ts`

**Step 1: DTO**
```typescript
// analyze.dto.ts
export class AnalyzeRequestDto {
  ageMonths!: number;
  sex?: 'MALE' | 'FEMALE' | null;
  productIds!: number[]; // seed 카탈로그에서 고른 제품 id (현재+후보 합쳐서)
}
```

**Step 2: 실패 테스트** (`analysis.service.spec.ts`) — Prisma를 mock해서 룰 엔진 연동만 검증
```typescript
import { Test } from '@nestjs/testing';
import { AnalysisService } from './analysis.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  product: { findMany: jest.fn() },
  ingredient: { findMany: jest.fn() },
  intakeReference: { findMany: jest.fn() },
};

describe('AnalysisService', () => {
  let service: AnalysisService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [AnalysisService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = mod.get(AnalysisService);
  });

  it('returns per-nutrient verdicts from DB data', async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([{ id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true }]);
    prismaMock.intakeReference.findMany.mockResolvedValue([
      { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: '5', upperLimit: '40', unit: '㎍', source: 'KDRIs 2020', sourceUrl: 'http://x' },
    ]);
    prismaMock.product.findMany.mockResolvedValue([
      { id: 10, name: 'A', ingredients: [{ ingredientId: 1, amount: '10', unit: '㎍' }] },
      { id: 11, name: 'B', ingredients: [{ ingredientId: 1, amount: '15', unit: '㎍' }] },
    ]);
    const out = await service.analyze({ ageMonths: 96, sex: null, productIds: [10, 11] });
    expect(out.byNutrient[0].verdict).toBe('DUPLICATE');
    expect(out.disclaimer).toContain('참고용');
  });
});
```

**Step 3: 실패 확인** → FAIL.

**Step 4: 구현** (`analysis.service.ts`) — Prisma `Decimal`은 `Number()`로 변환
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyzeRequestDto } from './dto/analyze.dto';
import { runAnalysis } from './rules/analyze';
import type { IngredientDef, ProductInput, ReferenceDef, NutrientResult } from './analysis.types';

const DISCLAIMER = '본 결과는 참고용이며 약사·소아과 상담을 권장합니다.';
const num = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));

@Injectable()
export class AnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(dto: AnalyzeRequestDto): Promise<{ byNutrient: NutrientResult[]; disclaimer: string }> {
    const ingRows = await this.prisma.ingredient.findMany();
    const ingredients: IngredientDef[] = ingRows.map((i) => ({ id: i.id, name: i.name, canonicalUnit: i.canonicalUnit, isFatSoluble: i.isFatSoluble }));

    const refRows = await this.prisma.intakeReference.findMany();
    const references: ReferenceDef[] = refRows.map((r) => ({
      ingredientId: r.ingredientId, ageMinMonths: r.ageMinMonths, ageMaxMonths: r.ageMaxMonths,
      sex: r.sex as ReferenceDef['sex'], recommended: num(r.recommended), upperLimit: num(r.upperLimit),
      unit: r.unit, source: r.source, sourceUrl: r.sourceUrl ?? null,
    }));

    const prodRows = await this.prisma.product.findMany({
      where: { id: { in: dto.productIds } },
      include: { ingredients: true },
    });
    const products: ProductInput[] = prodRows.map((p) => ({
      productId: p.id, name: p.name,
      amounts: p.ingredients.map((pi) => ({ ingredientId: pi.ingredientId, amount: Number(pi.amount), unit: pi.unit })),
    }));

    const byNutrient = runAnalysis({ ageMonths: dto.ageMonths, sex: dto.sex ?? null, products, ingredients, references });
    return { byNutrient, disclaimer: DISCLAIMER };
  }
}
```

**Step 5: 통과 확인** → PASS.

**Step 6: 커밋**
```bash
git add apps/api/src/analysis/dto apps/api/src/analysis/analysis.service.*
git commit -m "feat(api): AnalysisService loads catalog from Prisma and runs rule engine"
```

### Task C2: Controller + Module + 앱 등록

**Files:**
- Create: `apps/api/src/analysis/analysis.controller.ts`
- Create: `apps/api/src/analysis/analysis.module.ts`
- Create: `apps/api/test/analysis.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts` (imports에 AnalysisModule 추가)

**Step 1: Controller**
```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalyzeRequestDto } from './dto/analyze.dto';

@Controller('analyze')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}
  @Post()
  analyze(@Body() dto: AnalyzeRequestDto) {
    return this.analysis.analyze(dto);
  }
}
```

**Step 2: Module + app.module 등록**
```typescript
// analysis.module.ts
import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({ controllers: [AnalysisController], providers: [AnalysisService] })
export class AnalysisModule {}
```
`app.module.ts`의 `imports`에 `AnalysisModule` 추가 (PrismaModule은 @Global이라 주입됨).

**Step 3: e2e 테스트** (`test/analysis.e2e-spec.ts`) — AnalysisService를 mock으로 오버라이드해 라우팅·계약 검증
```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AnalysisModule } from '../src/analysis/analysis.module';
import { AnalysisService } from '../src/analysis/analysis.service';

describe('POST /analyze (e2e)', () => {
  let app: INestApplication;
  const stub = { analyze: jest.fn().mockResolvedValue({ byNutrient: [{ ingredientId: 1, verdict: 'OVER' }], disclaimer: '참고용' }) };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AnalysisModule] })
      .overrideProvider(AnalysisService).useValue(stub).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('returns the analysis report', async () => {
    const res = await request(app.getHttpServer()).post('/analyze').send({ ageMonths: 96, productIds: [10, 11] }).expect(201);
    expect(res.body.byNutrient[0].verdict).toBe('OVER');
  });
});
```

**Step 4: 실행** → `pnpm --filter @levit/api test:e2e` → PASS. (`make dev-api`로 수동 curl 확인 가능)

**Step 5: 커밋**
```bash
git add apps/api/src/analysis/analysis.controller.ts apps/api/src/analysis/analysis.module.ts apps/api/src/app.module.ts apps/api/test/analysis.e2e-spec.ts
git commit -m "feat(api): POST /analyze endpoint wired with AnalysisModule"
```

---

## Phase D — 근거 기반 LLM 설명 (grounding 가드레일)

### Task D1: ExplanationService (OpenAI, 환각 차단 프롬프트)

**Files:**
- Create: `apps/api/src/analysis/explanation.service.ts`
- Create: `apps/api/src/analysis/explanation.service.spec.ts`

**핵심 가드레일** (테스트로 강제):
- `UNKNOWN` 성분엔 LLM 호출 안 함 → "확인 불가" 고정 문구.
- 프롬프트엔 **계산된 수치/출처만** 들어가고 "제공된 값 외 추측 금지" 지시.
- OpenAI 클라이언트는 생성자 주입(테스트에서 mock).

**Step 1: 실패 테스트**
```typescript
import { ExplanationService } from './explanation.service';

const openaiMock = { chat: { completions: { create: jest.fn() } } } as any;

describe('ExplanationService', () => {
  const svc = new ExplanationService(openaiMock);
  beforeEach(() => jest.clearAllMocks());

  it('does NOT call the LLM for UNKNOWN nutrients', async () => {
    const out = await svc.explain({ ingredientName: '셀레늄', verdict: 'UNKNOWN', totalCanonical: null, unit: '', upperLimit: null, percentOfRecommended: null, reference: null });
    expect(out).toContain('확인 불가');
    expect(openaiMock.chat.completions.create).not.toHaveBeenCalled();
  });

  it('includes only grounded numbers in the prompt', async () => {
    openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: '설명' } }] });
    await svc.explain({ ingredientName: '비타민D', verdict: 'OVER', totalCanonical: 41, unit: '㎍', upperLimit: 40, percentOfRecommended: 820, reference: { source: 'KDRIs 2020', sourceUrl: 'http://x' } as any });
    const prompt = JSON.stringify(openaiMock.chat.completions.create.mock.calls[0][0]);
    expect(prompt).toContain('41');
    expect(prompt).toContain('KDRIs 2020');
    expect(prompt).toMatch(/추측 금지|제공된/);
  });
});
```

**Step 2: 실패 확인** → FAIL.

**Step 3: 구현**
```typescript
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { NutrientResult } from './analysis.types';

export type ExplainInput = Pick<NutrientResult, 'verdict' | 'totalCanonical' | 'unit' | 'upperLimit' | 'percentOfRecommended' | 'reference'> & { ingredientName: string };

@Injectable()
export class ExplanationService {
  constructor(private readonly openai: OpenAI) {}

  async explain(r: ExplainInput): Promise<string> {
    if (r.verdict === 'UNKNOWN') {
      return `${r.ingredientName}: 기준 데이터가 없어 확인 불가합니다. 전문가 상담을 권장합니다.`;
    }
    const facts = {
      성분: r.ingredientName, 합산량: `${r.totalCanonical}${r.unit}`, 상한: r.upperLimit,
      권장대비퍼센트: r.percentOfRecommended, 판정: r.verdict,
      출처: r.reference?.source, 출처링크: r.reference?.sourceUrl,
    };
    const res = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '너는 어린이 영양제 안전 설명가다. 아래 제공된 수치와 출처만 사용하고, 제공되지 않은 값은 추측 금지. 2~3문장 한국어로 쉽게 설명하고 출처를 언급한다.' },
        { role: 'user', content: JSON.stringify(facts) },
      ],
    });
    return res.choices[0]?.message?.content ?? '';
  }
}
```

**Step 4: 통과 확인** → PASS.

**Step 5: 커밋**
```bash
git add apps/api/src/analysis/explanation.service.*
git commit -m "feat(api): grounded LLM explanation with hallucination guardrails"
```

### Task D2: OpenAI provider + Service 연동

**Files:**
- Modify: `apps/api/src/analysis/analysis.module.ts` (OpenAI provider + ExplanationService 등록)
- Modify: `apps/api/src/analysis/analysis.service.ts` (각 결과에 `explanation` 첨부)
- Modify: `apps/api/src/analysis/analysis.service.spec.ts` (ExplanationService mock 주입)

**Step 1:** Module에 OpenAI factory provider 추가
```typescript
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { ExplanationService } from './explanation.service';
// providers에 추가:
// { provide: OpenAI, useFactory: (c: ConfigService) => new OpenAI({ apiKey: c.get('OPENAI_API_KEY') }), inject: [ConfigService] },
// ExplanationService,
```

**Step 2:** `analyze()`가 각 `byNutrient`에 `explanation` 추가 (UNKNOWN 포함 전부). spec의 mock에 ExplanationService stub 주입, `explanation` 필드 단언 추가.

**Step 3:** 실행 → `pnpm --filter @levit/api test -- analysis.service` → PASS.

**Step 4: 커밋**
```bash
git add apps/api/src/analysis
git commit -m "feat(api): attach grounded explanations to each nutrient result"
```

---

## Phase E — Seed 데이터 + 크롤러

### Task E1: KDRIs 기준 + 성분 seed

**Files:**
- Create: `apps/api/prisma/seed/standards.ts` (성분 5~8개 + 연령별 IntakeReference, KDRIs 2020 값)
- Create: `apps/api/prisma/seed.ts` (엔트리)
- Modify: `apps/api/package.json` (`"prisma": { "seed": "ts-node prisma/seed.ts" }` + `"db:seed": "prisma db seed"`)

> ⚠️ `standards.ts`의 권장량·상한 수치는 **KDRIs 2020 PDF에서 직접 옮겨 검증**할 것(임의값 금지). 성분: 비타민 D·A·E·C, 칼슘·철·아연(+유산균은 UL 없음 → UNKNOWN/DUPLICATE만). `sourceUrl`에 KDRIs/식약처 링크.

**Step 1:** seed 스크립트 작성(upsert로 idempotent). 각 Ingredient의 `canonicalUnit`/`isFatSoluble` 설정, 연령대(예: 72–107개월=6–8세 등) 밴드별 IntakeReference.

**Step 2:** 실행
```bash
pnpm --filter @levit/api exec ts-node prisma/seed.ts
```
Expected: "seeded N ingredients, M references".

**Step 3:** 검증 — `make db-studio` 또는 supabase MCP `execute_sql`로 `select count(*) from "IntakeReference"`.

**Step 4: 커밋**
```bash
git add apps/api/prisma/seed* apps/api/package.json
git commit -m "feat(api): seed KDRIs intake references + core ingredients"
```

### Task E2: iHerb 제품 seed (캐시된 JSON → DB)

**Files:**
- Create: `apps/api/prisma/seed/products.json` (iHerb 키즈 영양제 20~30개: name, brand, form, targetAgeLabel, sourceUrl, ingredients[{name, amount, unit}])
- Create: `apps/api/prisma/seed/products.ts` (JSON → Product/ProductIngredient upsert; 성분명으로 Ingredient 연결, 미존재 성분은 생성하되 canonicalUnit 지정)
- Modify: `apps/api/prisma/seed.ts` (products seed 호출 추가)

**Step 1~4:** products.ts 작성 → seed 재실행 → studio/SQL로 `Product`, `ProductIngredient` 행 확인 → 커밋.
```bash
git commit -m "feat(api): seed iHerb kids supplement catalog (cached)"
```

### Task E3: iHerb 크롤러 스크립트 ("크롤링 연동" 시연)

**Files:**
- Create: `apps/api/scripts/crawl-iherb.ts` (정상 브라우저 헤더 + 저빈도, 상세페이지 Supplement Facts HTML 파싱 → `prisma/seed/products.json` 생성)
- Modify: `apps/api/package.json` (`"crawl": "ts-node scripts/crawl-iherb.ts"`), 필요 시 `node-html-parser`/`cheerio` 추가

> 목적은 **연동 시연**(과제 요구). 런타임 아님 — 빌드 전 1회 실행해 JSON 캐시 생성. 차단 시 README 로그에 "차단→캐시 우회" 기록.

**Step:** 작성 → 소수 URL로 시범 실행 → 결과 JSON 일부 확인 → 커밋
```bash
git commit -m "feat(api): iHerb crawler producing cached products.json"
```

---

## Phase F — 프론트엔드 (얇게)

> ixartz 보일러플레이트는 Clerk 인증·i18n에 묶여 있음. MVP는 **인증 비의존 단독 체커 페이지**로 마찰 최소화. (필요 시 미들웨어에서 `/check` public 처리.)

### Task F1: API 클라이언트 + env

**Files:**
- Modify: `apps/web/src/libs/Env.ts` (client에 `NEXT_PUBLIC_API_URL: z.string().url().optional()` + runtimeEnv 추가)
- Create: `apps/web/src/libs/Api.ts` (`analyze(payload)` fetch 래퍼, base = `Env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`)
- Modify: `apps/web/.env` (`NEXT_PUBLIC_API_URL=http://localhost:3001`)

커밋: `feat(web): API client + NEXT_PUBLIC_API_URL env`

### Task F2: 체커 페이지 — 장바구니 트리거 + 점진적 공개

**Files:**
- Create: `apps/web/src/app/[locale]/(checker)/check/page.tsx`
- Create: `apps/web/src/components/checker/ProductPicker.tsx` (seed 제품 목록에서 "담기")
- Create: `apps/web/src/components/checker/AgeStep.tsx` (나이 입력 — 1단계 필수)

**흐름**: 제품 담기 → 어린이 영양제 ≥1 이면 나이 묻기 → 나이만으로 1차 검사(단독) → "다른 것도 먹나요?"로 추가 담기 → 재검사. 다자녀는 1회=1아이.

> 제품 목록은 API에 `GET /products`가 없으므로, **Task F2 전에 `apps/api`에 `GET /products`(seed 목록) 추가**(작은 컨트롤러 메서드 + 테스트 1개). 또는 MVP 단순화로 seed 목록을 프론트 상수로 두되, 권장은 API.

커밋: `feat(web): cart-triggered checker page with progressive disclosure`

### Task F3: 신뢰 리포트 카드

**Files:**
- Create: `apps/web/src/components/checker/ReportCard.tsx` (성분별 카드: verdict 색상 SAFE=초록/DUPLICATE=노랑/OVER=빨강/UNKNOWN=회색, 합산식 `A 10㎍ + B 15㎍ = 25㎍`, %RDA, 출처 링크, LLM 설명, 면책)
- Create: `apps/web/src/components/checker/RecommendedSetCard.tsx` (검증된 세트 추천 카드 — 구매는 mock 링크)

커밋: `feat(web): trust report card + verified-set recommendation card`

---

## Phase G — 배포 + README 로그

### Task G1: 배포
- **DB**: Supabase(이미 원격). 배포 호스트 env에 `DATABASE_URL`/`DIRECT_URL` 설정. seed 1회 실행.
- **API → Railway**: Root `apps/api`, build `pnpm build`, start `node dist/main`, env(`DATABASE_URL`,`DIRECT_URL`,`OPENAI_API_KEY`,`PORT`).
- **Web → Vercel**: Root `apps/web`, env `NEXT_PUBLIC_API_URL`(배포된 API URL). CORS는 `main.ts`에서 이미 `enableCors()`.

### Task G2: README "막힌 점 → 해결" 로그 + collaborator
- `README.md`(또는 데모 README)에 로그 추가: 크롤링 차단(쿠팡/네이버 이미지·안티봇)→iHerb HTML+캐시 / LLM 환각→계산을 코드로 분리 + grounding / 단위 불일치→정규화 테이블 / 안전 정확성→KDRIs 인용 + 면책 / 거짓경보→OVER는 UL 초과만.
- 제출 직전 `recruit@ilevit.com` collaborator 추가(초대 시점 평가).

커밋: `docs: deployment notes + 막힌 점→해결 log`

---

## Phase H — (옵션) pgvector RAG 레이어

> 코어 grounding은 구조화 lookup으로 충분. **literal RAG 시연이 꼭 필요할 때만** 추가.
- `StandardCitation` 모델(텍스트 chunk + `vector(1536)` 컬럼, raw SQL 마이그레이션으로 pgvector 확장 + 컬럼) 추가.
- KDRIs 인용문 chunk를 임베딩 → 저장. `explain()` 직전 `성분+나이`로 top-k retrieve해 **원문 인용**을 프롬프트에 주입.
- 판정(verdict)은 여전히 구조화 lookup이 담당(벡터검색은 설명 근거 텍스트에만).

---

## 완료 기준 (Definition of Done)
- [ ] 룰 엔진 전 함수 단위테스트 통과(units/reference/aggregate/verdict/analyze).
- [ ] `POST /analyze`가 seed 데이터로 비타민D 과다/중복 시나리오를 정확히 판정(거짓경보 없음).
- [ ] UNKNOWN 성분에 LLM 미호출 + "확인 불가" 표기.
- [ ] 프론트에서 담기→나이→리포트 흐름이 5분 내 결론.
- [ ] web/api/DB 배포되어 외부 링크로 데모 동작.
- [ ] README에 막힌 점→해결 로그 + 크롤러 1회 실행 흔적.
