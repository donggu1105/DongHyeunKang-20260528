# NutrientInfo 성분 돋보기 팝오버 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 영양소 이름(칼슘·비타민D·아연…)에 돋보기를 달아, 호버/탭 시 "우리 아이 나이별 적정량(권장·상한) + 단위(IU↔㎍) 정리"를 KDRIs 근거로 간단·가독성 있게 보여준다.

**Architecture:** NestJS에 `GET /ingredients`를 신설해 `IntakeReference` 전 연령대 기준표를 서빙(룰 엔진과 동일 진실원천). 웹은 1회 fetch·캐시하는 훅 + 재사용 `<NutrientInfo>` 팝오버 컴포넌트를 ProductCard·ReportCard에 배선. 적정량·단위는 전부 결정론 데이터(DB + 정적 환산표) — LLM 미개입.

**Tech Stack:** NestJS 11 + Prisma 6(Jest), Next.js 16 + React 19(vitest-browser-react), TypeScript.

**설계 출처:** `docs/plans/2026-05-30-nutrient-info-popover-design.md`

**전제:** 작업 디렉터리 루트 `/Users/joeykang/workspace/projects/levit`. API 테스트는 `pnpm --filter @levit/api test`, 웹 테스트는 `pnpm --filter @levit/web test`, 웹 타입/린트는 `pnpm --filter @levit/web check:types` / `npx ultracite check <file>`.

---

## Task 1: API — `formatAgeLabel` 순수 함수 (개월→"만 N–M세")

**Files:**
- Create: `apps/api/src/ingredients/age-label.ts`
- Test: `apps/api/src/ingredients/age-label.spec.ts`

**Step 1: 실패 테스트 작성**

`apps/api/src/ingredients/age-label.spec.ts`:
```ts
import { formatAgeLabel } from './age-label';

describe('formatAgeLabel', () => {
  it('formats a multi-year band as "만 N–M세"', () => {
    expect(formatAgeLabel(72, 107)).toBe('만 6–8세');
    expect(formatAgeLabel(12, 35)).toBe('만 1–2세');
    expect(formatAgeLabel(180, 227)).toBe('만 15–18세');
  });

  it('collapses a single-year band to "만 N세"', () => {
    expect(formatAgeLabel(36, 47)).toBe('만 3세');
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm --filter @levit/api test -- age-label`
Expected: FAIL — "Cannot find module './age-label'".

**Step 3: 최소 구현**

`apps/api/src/ingredients/age-label.ts`:
```ts
/** 개월 범위를 읽기 쉬운 "만 N–M세" 라벨로. min/max는 KDRIs 밴드 경계(개월). */
export function formatAgeLabel(ageMinMonths: number, ageMaxMonths: number): string {
  const minYear = Math.floor(ageMinMonths / 12);
  const maxYear = Math.floor(ageMaxMonths / 12);
  return minYear === maxYear ? `만 ${minYear}세` : `만 ${minYear}–${maxYear}세`;
}
```

**Step 4: 통과 확인**

Run: `pnpm --filter @levit/api test -- age-label`
Expected: PASS (2 tests).

**Step 5: 커밋**
```bash
git add apps/api/src/ingredients/age-label.ts apps/api/src/ingredients/age-label.spec.ts
git commit -m "feat(api): age-label 헬퍼(개월→만 N–M세)"
```

---

## Task 2: API — `IngredientsService.list()`

**Files:**
- Create: `apps/api/src/ingredients/ingredients.service.ts`
- Test: `apps/api/src/ingredients/ingredients.service.spec.ts`

참고 패턴: `apps/api/src/products/products.service.ts`, `products.service.spec.ts` (PrismaService를 mock으로 주입, Decimal→number 변환을 서비스 경계에서 끝냄).

**Step 1: 실패 테스트 작성**

`apps/api/src/ingredients/ingredients.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { IngredientsService } from './ingredients.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = { ingredient: { findMany: jest.fn() } } as any;

describe('IngredientsService', () => {
  let service: IngredientsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = mod.get(IngredientsService);
  });

  it('maps an ingredient with age-banded references (Decimal→number, ageLabel, source)', async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([
      {
        id: 1,
        name: '비타민D',
        canonicalUnit: '㎍',
        isFatSoluble: true,
        references: [
          { ageMinMonths: 72, ageMaxMonths: 107, recommended: '5', upperLimit: '40', unit: '㎍', source: 'KDRIs 2020', sourceUrl: 'http://k' },
        ],
      },
    ]);

    const out = await service.list();

    expect(out).toEqual([
      {
        id: 1,
        name: '비타민D',
        canonicalUnit: '㎍',
        isFatSoluble: true,
        references: [
          { ageMinMonths: 72, ageMaxMonths: 107, ageLabel: '만 6–8세', recommended: 5, upperLimit: 40, unit: '㎍' },
        ],
        source: 'KDRIs 2020',
        sourceUrl: 'http://k',
      },
    ]);
    expect(typeof out[0].references[0].recommended).toBe('number');
  });

  it('returns an empty references array for ingredients with no KDRIs standard', async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([
      { id: 9, name: '유산균', canonicalUnit: '억CFU', isFatSoluble: false, references: [] },
    ]);

    const out = await service.list();

    expect(out[0].references).toEqual([]);
    expect(out[0].source).toBe('KDRIs 2020 / 식약처'); // 폴백
    expect(out[0].sourceUrl).toBeNull();
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm --filter @levit/api test -- ingredients.service`
Expected: FAIL — module not found.

**Step 3: 최소 구현**

`apps/api/src/ingredients/ingredients.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatAgeLabel } from './age-label';

export type IngredientReference = {
  ageMinMonths: number;
  ageMaxMonths: number;
  ageLabel: string;
  recommended: number | null;
  upperLimit: number | null;
  unit: string;
};

export type IngredientInfo = {
  id: number;
  name: string;
  canonicalUnit: string;
  isFatSoluble: boolean;
  references: IngredientReference[];
  source: string;
  sourceUrl: string | null;
};

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<IngredientInfo[]> {
    const rows = await this.prisma.ingredient.findMany({
      include: { references: { orderBy: { ageMinMonths: 'asc' } } },
      orderBy: { id: 'asc' },
    });

    return rows.map((ing) => ({
      id: ing.id,
      name: ing.name,
      canonicalUnit: ing.canonicalUnit,
      isFatSoluble: ing.isFatSoluble,
      references: ing.references.map((r) => ({
        ageMinMonths: r.ageMinMonths,
        ageMaxMonths: r.ageMaxMonths,
        ageLabel: formatAgeLabel(r.ageMinMonths, r.ageMaxMonths),
        recommended: r.recommended === null ? null : Number(r.recommended),
        upperLimit: r.upperLimit === null ? null : Number(r.upperLimit),
        unit: r.unit,
      })),
      // 전 구간 동일 출처라 첫 밴드 대표값. 기준 없는 성분은 폴백 라벨.
      source: ing.references[0]?.source ?? 'KDRIs 2020 / 식약처',
      sourceUrl: ing.references[0]?.sourceUrl ?? null,
    }));
  }
}
```

**Step 4: 통과 확인**

Run: `pnpm --filter @levit/api test -- ingredients.service`
Expected: PASS (2 tests).

**Step 5: 커밋**
```bash
git add apps/api/src/ingredients/ingredients.service.ts apps/api/src/ingredients/ingredients.service.spec.ts
git commit -m "feat(api): IngredientsService — IntakeReference 전 연령 기준표 매핑"
```

---

## Task 3: API — Controller + Module 등록 (`GET /ingredients` 노출)

**Files:**
- Create: `apps/api/src/ingredients/ingredients.controller.ts`
- Create: `apps/api/src/ingredients/ingredients.module.ts`
- Modify: `apps/api/src/app.module.ts`

참고: `apps/api/src/products/products.controller.ts`, `products.module.ts` (PrismaModule이 @Global이라 재import 불필요).

**Step 1: Controller + Module 작성**

`apps/api/src/ingredients/ingredients.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}
  @Get()
  list() {
    return this.ingredients.list();
  }
}
```

`apps/api/src/ingredients/ingredients.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

@Module({
  controllers: [IngredientsController],
  providers: [IngredientsService],
})
export class IngredientsModule {}
```

**Step 2: app.module.ts에 등록**

`apps/api/src/app.module.ts` — import 추가 + `imports` 배열에 `IngredientsModule` 추가 (ProductsModule 옆):
```ts
import { IngredientsModule } from './ingredients/ingredients.module';
// ...
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AnalysisModule,
    ProductsModule,
    IngredientsModule,
  ],
```

**Step 3: 전체 API 테스트 통과 확인**

Run: `pnpm --filter @levit/api test`
Expected: PASS (회귀 0).

**Step 4: 수동 스모크 (API 떠 있으면)**

Run: `curl -s http://localhost:3001/ingredients | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);console.log(a.length,'성분; 비타민D refs=',a.find(x=>x.name==='비타민D')?.references.length)})"`
Expected: `8 성분; 비타민D refs= 6` (대략).

**Step 5: 커밋**
```bash
git add apps/api/src/ingredients/ingredients.controller.ts apps/api/src/ingredients/ingredients.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): GET /ingredients 엔드포인트(기준표 서빙)"
```

---

## Task 4: Web — Api.ts 타입 + `getIngredients()`

**Files:**
- Modify: `apps/web/src/libs/Api.ts`

**Step 1: 타입 + fetch 추가**

`apps/web/src/libs/Api.ts` — `CatalogIngredient` 타입 근처에 추가:
```ts
// ── Ingredient reference (GET /ingredients) ───────────────────────────────
export type IngredientReference = {
  ageMinMonths: number;
  ageMaxMonths: number;
  ageLabel: string;
  recommended: number | null;
  upperLimit: number | null;
  unit: string;
};

export type IngredientInfo = {
  id: number;
  name: string;
  canonicalUnit: string;
  isFatSoluble: boolean;
  references: IngredientReference[];
  source: string;
  sourceUrl: string | null;
};
```
그리고 `getProducts` 옆에:
```ts
export function getIngredients(): Promise<IngredientInfo[]> {
  return request<IngredientInfo[]>('/ingredients');
}
```

**Step 2: 타입체크**

Run: `pnpm --filter @levit/web check:types 2>&1 | grep -E "Api.ts" || echo "no new Api.ts errors"`
Expected: `no new Api.ts errors` (기존 Clerk/vite 2건은 무관).

**Step 3: 커밋**
```bash
git add apps/web/src/libs/Api.ts
git commit -m "feat(web): getIngredients API 클라이언트 + 타입"
```

---

## Task 5: Web — 정적 데이터(단위 환산 + 역할 카피)

**Files:**
- Create: `apps/web/src/components/checker/nutrientFacts.ts`
- Test: `apps/web/src/components/checker/nutrientFacts.test.ts`

> 단위 환산은 결정론 상수. 역할 한 줄도 정적(LLM 아님). 8개 캐논 성분 기준.

**Step 1: 실패 테스트 작성**

`apps/web/src/components/checker/nutrientFacts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatIuHelper, NUTRIENT_ROLE } from './nutrientFacts';

describe('nutrientFacts', () => {
  it('converts canonical amount to an IU helper string for fat-soluble vitamins', () => {
    expect(formatIuHelper('비타민D', 25)).toBe('25㎍ = 1000 IU');
  });

  it('returns null for nutrients with no IU convention (e.g., 칼슘)', () => {
    expect(formatIuHelper('칼슘', 300)).toBeNull();
  });

  it('has a short role copy for every canon nutrient', () => {
    for (const n of ['비타민D', '비타민A', '비타민C', '비타민E', '칼슘', '철', '아연', '유산균']) {
      expect(NUTRIENT_ROLE[n]).toBeTruthy();
    }
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm --filter @levit/web test -- nutrientFacts`
Expected: FAIL — module not found.

**Step 3: 최소 구현**

`apps/web/src/components/checker/nutrientFacts.ts`:
```ts
// 8개 캐논 성분 — 한 줄 역할(정적 카피, LLM 아님).
export const NUTRIENT_ROLE: Record<string, string> = {
  비타민D: '뼈·면역',
  비타민A: '시력·점막',
  비타민C: '항산화·면역',
  비타민E: '항산화',
  칼슘: '뼈·치아',
  철: '혈액·산소 운반',
  아연: '면역·성장',
  유산균: '장 건강',
};

// 라벨에 IU가 흔한 지방용성 비타민만. perIu = 캐논단위 1당 IU.
const IU_PER_CANONICAL: Record<string, number> = {
  비타민D: 40, // 1㎍ = 40 IU
  비타민A: 3.33, // 1㎍RAE ≈ 3.33 IU
  비타민E: 1.49, // 1mg ≈ 1.49 IU
};

/** 캐논 함량 → "X㎍ = Y IU" 도움말. IU 관례 없는 성분은 null. */
export function formatIuHelper(name: string, canonicalAmount: number): string | null {
  const per = IU_PER_CANONICAL[name];
  if (per === undefined) {
    return null;
  }
  const iu = Math.round(canonicalAmount * per);
  const unit = name === '비타민E' ? 'mg' : '㎍';
  return `${canonicalAmount}${unit} = ${iu} IU`;
}
```

**Step 4: 통과 확인**

Run: `pnpm --filter @levit/web test -- nutrientFacts`
Expected: PASS (3 tests).

**Step 5: 커밋**
```bash
git add apps/web/src/components/checker/nutrientFacts.ts apps/web/src/components/checker/nutrientFacts.test.ts
git commit -m "feat(web): 성분 정적 데이터(IU 환산 + 역할 카피)"
```

---

## Task 6: Web — `useIngredients` 캐시 훅

**Files:**
- Create: `apps/web/src/hooks/useIngredients.ts`

> vitest 설정상 `src/hooks/**/*.test.ts`는 ui(browser) 프로젝트에서 돈다. 훅 자체는 컴포넌트 테스트(Task 7)에서 간접 검증하므로 별도 테스트 파일은 생략(YAGNI). 모듈 레벨 promise 캐시로 앱 전체 1회 fetch.

**Step 1: 구현**

`apps/web/src/hooks/useIngredients.ts`:
```ts
'use client';

import { useEffect, useState } from 'react';
import { getIngredients, type IngredientInfo } from '@/libs/Api';

// 모듈 레벨 캐시 — 호버마다 X, 앱에서 단 1회 fetch해 모든 팝오버가 공유.
let cache: Promise<IngredientInfo[]> | null = null;
function loadOnce(): Promise<IngredientInfo[]> {
  if (!cache) {
    cache = getIngredients().catch((err) => {
      cache = null; // 실패 시 캐시 무효화 → 다음 시도 재요청
      throw err;
    });
  }
  return cache;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; byName: Map<string, IngredientInfo> }
  | { status: 'error' };

export function useIngredients(): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    loadOnce()
      .then((list) => {
        if (active) {
          setState({ status: 'ready', byName: new Map(list.map((i) => [i.name, i])) });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'error' });
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
```

**Step 2: 타입체크**

Run: `pnpm --filter @levit/web check:types 2>&1 | grep -E "useIngredients" || echo "no useIngredients errors"`
Expected: `no useIngredients errors`.

**Step 3: 커밋**
```bash
git add apps/web/src/hooks/useIngredients.ts
git commit -m "feat(web): useIngredients 모듈캐시 훅(앱 1회 fetch)"
```

---

## Task 7: Web — `<NutrientInfo>` 팝오버 컴포넌트

**Files:**
- Create: `apps/web/src/components/checker/NutrientInfo.tsx`
- Test: `apps/web/src/components/checker/NutrientInfo.test.tsx`

> 핵심 제약: ProductCard는 카드 전체가 `<button>`이라 트리거를 `<button>`으로 두면 중첩 버튼. → 트리거는 `<span role="button" tabIndex={0}>` + 클릭 `stopPropagation`. 호버/포커스 open, 탭 토글, Esc/바깥클릭 닫힘.

**Step 1: 실패 테스트 작성**

`apps/web/src/components/checker/NutrientInfo.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { NutrientInfo } from './NutrientInfo';
import type { IngredientInfo } from '@/libs/Api';

const VIT_D: IngredientInfo = {
  id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true,
  references: [
    { ageMinMonths: 36, ageMaxMonths: 71, ageLabel: '만 3–5세', recommended: 5, upperLimit: 35, unit: '㎍' },
    { ageMinMonths: 72, ageMaxMonths: 107, ageLabel: '만 6–8세', recommended: 5, upperLimit: 40, unit: '㎍' },
  ],
  source: 'KDRIs 2020', sourceUrl: 'http://k',
};

// useIngredients를 모킹 — 네트워크 없이 ready 상태 주입.
vi.mock('@/hooks/useIngredients', () => ({
  useIngredients: () => ({ status: 'ready', byName: new Map([['비타민D', VIT_D]]) }),
}));

describe('NutrientInfo', () => {
  it('opens on focus and shows the age table with the child band highlighted', async () => {
    await render(
      <NutrientInfo ingredientName="비타민D" ageMonths={72}>비타민D</NutrientInfo>,
    );
    await page.getByRole('button', { name: /비타민D/u }).focus();
    await expect.element(page.getByText('만 6–8세')).toBeVisible();
    await expect.element(page.getByText('40㎍')).toBeVisible(); // 상한
  });

  it('does NOT toggle a parent button (stopPropagation)', async () => {
    const onParent = vi.fn();
    await render(
      <button type="button" onClick={onParent}>
        <NutrientInfo ingredientName="비타민D" ageMonths={null}>비타민D</NutrientInfo>
      </button>,
    );
    await page.getByRole('button', { name: /비타민D/u }).click();
    expect(onParent).not.toHaveBeenCalled();
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm --filter @levit/web test -- NutrientInfo`
Expected: FAIL — module not found.

**Step 3: 구현**

`apps/web/src/components/checker/NutrientInfo.tsx`:
```tsx
'use client';

import { type KeyboardEvent, type ReactNode, useId, useState } from 'react';
import { useIngredients } from '@/hooks/useIngredients';
import { formatIuHelper, NUTRIENT_ROLE } from './nutrientFacts';

type Props = { ingredientName: string; ageMonths?: number | null; children: ReactNode };

export function NutrientInfo({ ingredientName, ageMonths, children }: Props) {
  const state = useIngredients();
  const [open, setOpen] = useState(false);
  const popoverId = useId();

  const info = state.status === 'ready' ? state.byName.get(ingredientName) : undefined;

  // 캐논 외 성분(데이터에 없음)·로딩/에러로 info 없음 → 돋보기 없이 그냥 텍스트.
  if (state.status !== 'ready' || !info) {
    return <span>{children}</span>;
  }

  const role = NUTRIENT_ROLE[ingredientName];
  const childBand =
    ageMonths == null
      ? null
      : info.references.find((r) => ageMonths >= r.ageMinMonths && ageMonths <= r.ageMaxMonths);
  const iuHelper =
    childBand?.recommended != null ? formatIuHelper(ingredientName, childBand.recommended) : null;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <span
      className="relative inline-flex items-center gap-0.5"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        className="inline-flex cursor-help items-center gap-0.5 underline decoration-dotted underline-offset-2"
        onClick={(e) => {
          e.stopPropagation(); // 부모 카드(담기 버튼) 토글 방지
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      >
        {children}
        <span aria-hidden="true" className="text-xs opacity-60">🔍</span>
      </span>

      {open && (
        <div
          id={popoverId}
          role="tooltip"
          className="absolute top-full left-0 z-20 mt-1 w-60 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-lg"
        >
          <p className="flex items-center justify-between gap-2 font-semibold text-gray-900 text-sm">
            <span>{ingredientName}</span>
            {role && <span className="font-normal text-gray-500 text-xs">{role}</span>}
          </p>

          {iuHelper && (
            <p className="mt-1 rounded bg-blue-50 px-2 py-1 text-blue-700 text-xs">💊 {iuHelper}</p>
          )}

          {info.references.length === 0 ? (
            <p className="mt-2 text-gray-500 text-xs">공식 기준이 없어 확인불가예요.</p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left font-normal">나이</th>
                  <th className="text-right font-normal">권장</th>
                  <th className="text-right font-normal">상한</th>
                </tr>
              </thead>
              <tbody>
                {info.references.map((r) => {
                  const isChild = childBand?.ageMinMonths === r.ageMinMonths;
                  return (
                    <tr
                      key={r.ageMinMonths}
                      className={isChild ? 'font-bold text-gray-900' : 'text-gray-400'}
                    >
                      <td className="text-left">
                        {isChild ? '▸ ' : ''}
                        {r.ageLabel}
                      </td>
                      <td className="text-right">{r.recommended ?? '-'}{r.unit}</td>
                      <td className="text-right">{r.upperLimit ?? '-'}{r.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <p className="mt-2 text-gray-400 text-[10px]">
            기준: {info.source}
            {info.sourceUrl && (
              <>
                {' · '}
                <a
                  className="text-blue-600 underline"
                  href={info.sourceUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  출처
                </a>
              </>
            )}
          </p>
        </div>
      )}
    </span>
  );
}
```

**Step 4: 통과 확인**

Run: `pnpm --filter @levit/web test -- NutrientInfo`
Expected: PASS (2 tests).

**Step 5: 린트**

Run: `npx --prefix apps/web ultracite check apps/web/src/components/checker/NutrientInfo.tsx apps/web/src/components/checker/nutrientFacts.ts apps/web/src/hooks/useIngredients.ts` (또는 `cd apps/web && npx ultracite fix <files>`)
Expected: clean.

**Step 6: 커밋**
```bash
git add apps/web/src/components/checker/NutrientInfo.tsx apps/web/src/components/checker/NutrientInfo.test.tsx
git commit -m "feat(web): NutrientInfo 성분 돋보기 팝오버(호버/탭/Esc, 중첩버튼 회피)"
```

---

## Task 8: Web — ProductCard 배선

**Files:**
- Modify: `apps/web/src/components/checker/ProductCard.tsx`

> 카드는 ageMonths 모름(둘러보기) → 강조 없이 전 연령표. 성분 이름만 NutrientInfo로 감싼다.

**Step 1: import 추가 + 성분 이름 래핑**

`apps/web/src/components/checker/ProductCard.tsx` 상단 import에 추가:
```ts
import { NutrientInfo } from './NutrientInfo';
```
성분 리스트의 이름 span을 교체:
```tsx
// 변경 전:
<span className="truncate text-gray-500">{ing.name}</span>
// 변경 후:
<span className="truncate text-gray-500">
  <NutrientInfo ingredientName={ing.name}>{ing.name}</NutrientInfo>
</span>
```

**Step 2: 타입/린트/테스트**

Run: `pnpm --filter @levit/web check:types 2>&1 | grep ProductCard || echo ok` → `ok`
Run: `cd apps/web && npx ultracite check src/components/checker/ProductCard.tsx`
Expected: clean.

**Step 3: 커밋**
```bash
git add apps/web/src/components/checker/ProductCard.tsx
git commit -m "feat(web): ProductCard 성분에 NutrientInfo 배선"
```

---

## Task 9: Web — ReportCard 배선 (+ ageMonths 전달)

**Files:**
- Modify: `apps/web/src/components/checker/ReportCard.tsx`
- Modify: `apps/web/src/app/[locale]/(checker)/page.tsx`

> ReportCard는 현재 `report`만 받는다. 아이 구간 강조를 위해 `ageMonths`를 page에서 내려보낸다.

**Step 1: ReportCard에 ageMonths prop 추가 + 래핑**

`ReportCard.tsx`:
- import 추가: `import { NutrientInfo } from './NutrientInfo';`
- `NutrientCard`에 `ageMonths` 전달:
```tsx
function NutrientCard({ nutrient, ageMonths }: { nutrient: NutrientResult; ageMonths: number | null }) {
  // ...
  // 변경 전: <p className="text-lg font-semibold text-gray-900">{nutrient.ingredientName}</p>
  // 변경 후:
  <p className="text-lg font-semibold text-gray-900">
    <NutrientInfo ingredientName={nutrient.ingredientName} ageMonths={ageMonths}>
      {nutrient.ingredientName}
    </NutrientInfo>
  </p>
```
- `ReportCard` 시그니처 + 매핑:
```tsx
export function ReportCard({ report, ageMonths }: { report: AnalyzeResponse; ageMonths: number | null }) {
  // ...
  {report.byNutrient.map((nutrient) => (
    <NutrientCard key={nutrient.ingredientId} nutrient={nutrient} ageMonths={ageMonths} />
  ))}
```

**Step 2: page.tsx에서 ageMonths 전달**

`apps/web/src/app/[locale]/(checker)/page.tsx` — ReportCard 렌더 지점:
```tsx
// 변경 전: <ReportCard report={report} />
// 변경 후: <ReportCard report={report} ageMonths={ageYears === null ? null : Math.round(ageYears * 12)} />
```

**Step 3: 타입/린트**

Run: `pnpm --filter @levit/web check:types 2>&1 | grep -E "ReportCard|page.tsx" || echo ok` → `ok`
Run: `cd apps/web && npx ultracite check src/components/checker/ReportCard.tsx "src/app/[locale]/(checker)/page.tsx"`
Expected: clean.

**Step 4: 커밋**
```bash
git add apps/web/src/components/checker/ReportCard.tsx "apps/web/src/app/[locale]/(checker)/page.tsx"
git commit -m "feat(web): ReportCard 성분에 NutrientInfo 배선(아이 나이 구간 강조)"
```

---

## Task 10: 전체 검증 + 수동 확인

**Step 1: API 전체 테스트**

Run: `pnpm --filter @levit/api test`
Expected: 회귀 0, 신규 통과.

**Step 2: 웹 테스트 + 타입 + 린트**

Run: `pnpm --filter @levit/web test`
Run: `pnpm --filter @levit/web check:types 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep "Found"`
Expected: 신규 에러 0 (기존 Clerk/vite 2건만).

**Step 3: 수동 확인 (브라우저)**

- 서버 띄우고 **`http://localhost:3000/`** (이 dev 서버는 IPv6 바인딩 — `localhost`로 접속, `127.0.0.1` 아님. CLAUDE.md gotcha 역방향).
- ProductCard 성분(예: 비타민D)에 호버 → 팝오버에 전 연령표 + IU 환산 노출.
- 세트 담기 → 나이 입력 → 분석 → ReportCard 성분 호버 → **아이 구간 굵게 강조** 확인.
- 유산균 호버 → "공식 기준이 없어 확인불가" 분기 확인.
- 성분 호버 클릭이 "담기" 토글을 발화시키지 않는지 확인(stopPropagation).

**Step 4: 의사결정 로그 + 디자인 문서 갱신**

`docs/submission/engineering-decisions.md`에 3줄 엔트리(요구사항/고민/해결) 추가 후 커밋:
```bash
git add docs/submission/engineering-decisions.md
git commit -m "docs: NutrientInfo 성분 돋보기 의사결정 로그"
```

---

## 완료 기준 (Definition of Done)

- `GET /ingredients`가 8개 캐논 성분 + 전 연령 references(ageLabel 포함) 반환, 유산균은 `references: []`.
- ProductCard·ReportCard 성분에 돋보기, 호버/포커스/탭으로 팝오버, Esc/바깥클릭 닫힘.
- ReportCard에서 아이 나이 구간 강조, ProductCard는 강조 없이 전 연령표.
- IU 환산은 지방용성(D/A/E)에만, 기준 없는 성분은 "확인불가" 분기.
- fetch 실패/캐논 외 성분은 그레이스풀(돋보기 미렌더), 페이지 무중단.
- API/웹 테스트 그린, 신규 타입/린트 에러 0, 트러스트 철학 유지(LLM 미개입).
```
```
