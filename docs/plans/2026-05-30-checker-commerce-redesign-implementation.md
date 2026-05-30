# 커머스형 체커 화면 재구성 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 영양제 안전 체커를 페르소나 → 제품 담기 → 나이 → 리포트의 4단계 스텝 흐름으로 재구성하고, 제품 담기 단계를 vitaminshop 스타일 커머스 상품 그리드(이미지·정상가·판매가·할인율·장바구니)로 만든다.

**Architecture:** 안전 판정 룰 엔진(`apps/api/src/analysis`, `rules/`)은 **무변경**. 변경은 (1) `Product` 스키마에 `listPrice` 추가 + 데모 이미지/가격 백필, (2) `/products` 응답에 `imageUrl·price·listPrice` 노출, (3) 웹 `/`(checker) 페이지를 스텝퍼 + 하단 스티키 카트바로 재구성, 커머스형 `ProductCard`/`ProductGrid`, 페르소나를 "테마 세트" 카드로 노출, (4) `/check` → `/` 리다이렉트.

**Tech Stack:** NestJS 11 + Prisma 6 (Supabase Postgres), Jest. Next.js 16 (App Router, `[locale]`, `'use client'`), Tailwind, next/image (로컬 `public/` 이미지). 설계 근거: `docs/plans/2026-05-30-checker-commerce-redesign-design.md`.

**중요 규칙:**
- 모든 의미 있는 변경마다 `docs/submission/engineering-decisions.md`에 3줄(요구사항/고민/해결) 추가.
- 가격·이미지는 **표시 전용 더미** — 판정 근거로 쓰지 않는다. 코드 주석에 명시.
- API 변경은 TDD(spec 먼저). 웹 컴포넌트는 테스트 하네스가 없으므로 `check:types` + `lint` + 4뷰포트 수동 확인으로 검증.
- 백엔드 명령은 `pnpm --filter @levit/api …`, 웹은 `pnpm --filter @levit/web …`. 작업 전 `pnpm install` 확인.

---

## Task 1: `Product`에 `listPrice`(정상가) 추가 + DB 반영

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Product`, 약 52–66행)

**Step 1: 스키마 필드 추가**

`model Product`의 `price Int?` 바로 아래에 추가:

```prisma
  price          Int? // KRW (판매가)
  listPrice      Int? // KRW 정상가(취소선용). 데모 더미 — 판정과 무관
```

**Step 2: Prisma client 재생성 + DB push**

Run: `pnpm --filter @levit/api db:push && pnpm --filter @levit/api prisma:generate`
Expected: `db push` 성공("Your database is now in sync"), client 생성 성공. (DIRECT_URL 사용 — `apps/api/.env` 필요.)

**Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(api): Product에 listPrice(정상가) 추가 — 커머스 표시용"
```

---

## Task 2: `/products` 응답에 `imageUrl·price·listPrice` 노출 (TDD)

**Files:**
- Test: `apps/api/src/products/products.service.spec.ts`
- Modify: `apps/api/src/products/products.service.ts`

**Step 1: 실패하는 테스트로 변경**

`products.service.spec.ts`의 mock 입력에 `listPrice` 추가하고, 기대 출력(`expect(out).toEqual([...])`)에 신규 필드를 포함하도록 수정:

```ts
// mock 입력: price/imageUrl 옆에 추가
price: 12000,
listPrice: 20000,
imageUrl: 'http://img',
// ...
// 기대 출력 객체에 추가 (sourceUrl 아래)
        sourceUrl: 'http://x',
        imageUrl: 'http://img',
        price: 12000,
        listPrice: 20000,
        ingredients: [{ name: '비타민D', amount: 10, unit: '㎍' }],
```

> 참고: mock의 `price`는 number로 둔다(스키마가 `Int?`). 기존 `price: '12000'`(string)이면 number로 교체.

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @levit/api test -- products/products.service`
Expected: FAIL — 출력에 `imageUrl/price/listPrice` 없음(현재 매핑이 누락).

**Step 3: 서비스 매핑/타입 수정**

`products.service.ts` `CatalogProduct` 타입과 `list()` map에 추가:

```ts
export type CatalogProduct = {
  id: number;
  name: string;
  brand: string | null;
  form: string | null;
  targetAgeLabel: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  price: number | null;
  listPrice: number | null;
  ingredients: { name: string; amount: number; unit: string }[];
};
// list() return map 안:
      sourceUrl: p.sourceUrl ?? null,
      imageUrl: p.imageUrl ?? null,
      price: p.price ?? null,
      listPrice: p.listPrice ?? null,
      ingredients: p.ingredients.map((pi) => ({ /* 그대로 */ })),
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @levit/api test -- products/products.service`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/products/products.service.ts apps/api/src/products/products.service.spec.ts
git commit -m "feat(api): /products에 imageUrl·price·listPrice 노출"
```

---

## Task 3: 웹 API 클라이언트 타입 확장

**Files:**
- Modify: `apps/web/src/libs/Api.ts` (`CatalogProduct`, 17–25행)

**Step 1: 타입 추가**

```ts
export type CatalogProduct = {
  id: number;
  name: string;
  brand: string | null;
  form: string | null;
  targetAgeLabel: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  price: number | null;
  listPrice: number | null;
  ingredients: CatalogIngredient[];
};
```

**Step 2: 타입체크**

Run: `pnpm --filter @levit/web check:types`
Expected: PASS (신규 옵셔널 필드 추가만 — 기존 사용처 영향 없음).

**Step 3: Commit**

```bash
git add apps/web/src/libs/Api.ts
git commit -m "feat(web): CatalogProduct에 imageUrl·price·listPrice 타입 추가"
```

---

## Task 4: 데모 이미지·가격 백필 스크립트

vitaminshop 상품 이미지를 로컬로 다운로드하고, 30개 제품에 결정적 랜덤으로 이미지/가격을 매핑한다. **타사 자산을 POC 데모 목적으로만 사용.**

**Files:**
- Create: `apps/api/scripts/backfill-demo-media.ts`
- Modify: `apps/api/package.json` (scripts)
- Create(런타임 산출물): `apps/web/public/products/p01.jpg … pNN.jpg`

**Step 1: 스크립트 작성**

```ts
// apps/api/scripts/backfill-demo-media.ts
//
// 데모 전용: vitaminshop 상품 이미지/가격을 우리 상품에 결정적 랜덤 매핑한다.
// 타사 이미지/가격은 POC 데모 목적 더미 데이터이며, 안전 판정과 무관하다.
// 재실행 시 동일 결과(제품 id 기반 의사난수) — 시드 재실행 후에도 안정.
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC_DIR = join(__dirname, '../../web/public/products');
const PAGES = ['https://vitaminshop.co.kr/'];
// 라이브 스크랩이 부족할 때를 대비한 확인된 폴백 URL (본 세션 추출).
const FALLBACK = [
  'https://vitaminshop.co.kr/web/product/medium/202602/c102723ee7085c40096ee6f3283e013b.jpg',
  'https://vitaminshop.co.kr/web/product/medium/202506/6c356411ae3e2f6175f3b193cdd36cee.jpg',
  'https://vitaminshop.co.kr/web/product/medium/202602/67a67194c47732416e9f97a28a59a970.jpg',
  'https://vitaminshop.co.kr/web/product/medium/202506/b06f06145e9aa66c78d5d34d76fb84bc.jpg',
  'https://vitaminshop.co.kr/web/product/medium/202508/a7573353b0c8e971e66f9996e74e0ae3.jpg',
  'https://vitaminshop.co.kr/web/product/medium/202507/477b21def0d788f20e7a3a3ef751b715.jpg',
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

async function collectImageUrls(): Promise<string[]> {
  const found = new Set<string>();
  for (const url of PAGES) {
    try {
      const html = await fetch(url).then((r) => r.text());
      const m = html.match(
        /https:\/\/vitaminshop\.co\.kr\/web\/product\/[a-z]+\/[^"'\s)]+\.(?:jpg|jpeg|png)/gi,
      );
      m?.forEach((u) => found.add(u));
    } catch (e) {
      console.warn(`[backfill] fetch 실패: ${url}`, e);
    }
  }
  FALLBACK.forEach((u) => found.add(u));
  return Array.from(found).slice(0, 30);
}

async function download(urls: string[]): Promise<string[]> {
  await mkdir(PUBLIC_DIR, { recursive: true });
  const local: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const name = `p${String(i + 1).padStart(2, '0')}.jpg`;
    try {
      const buf = Buffer.from(await fetch(urls[i]).then((r) => r.arrayBuffer()));
      await writeFile(join(PUBLIC_DIR, name), buf);
      local.push(`/products/${name}`); // next/image용 public 경로
    } catch (e) {
      console.warn(`[backfill] 이미지 다운로드 실패: ${urls[i]}`, e);
    }
  }
  return local;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const images = await download(await collectImageUrls());
    if (images.length === 0) throw new Error('다운로드된 이미지가 없습니다.');
    const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
    for (const p of products) {
      const rand = rng(p.id);
      const img = images[Math.floor(rand() * images.length)];
      // 정상가 9,000~60,000 (1,000원 단위), 할인 20~50%
      const listPrice = (9 + Math.floor(rand() * 52)) * 1000;
      const discount = 0.2 + rand() * 0.3;
      const price = Math.round((listPrice * (1 - discount)) / 100) * 100;
      await prisma.product.update({
        where: { id: p.id },
        data: { imageUrl: img, listPrice, price },
      });
    }
    console.log(`[backfill] ${products.length}개 제품에 이미지/가격 매핑 완료 (이미지 ${images.length}장).`);
  } finally {
    await prisma.$disconnect();
  }
}
main();
```

**Step 2: package.json 스크립트 추가**

`apps/api/package.json` scripts에 추가:

```json
    "backfill:demo": "ts-node scripts/backfill-demo-media.ts",
```

**Step 3: 실행**

Run: `pnpm --filter @levit/api db:seed && pnpm --filter @levit/api backfill:demo`
Expected: "…개 제품에 이미지/가격 매핑 완료" 로그. `apps/web/public/products/`에 `pNN.jpg` 생성. (db:seed가 `product.deleteMany()` 후 재생성하므로 백필은 seed 다음에 실행.)

**Step 4: DB 확인**

Run(MCP supabase 또는): `SELECT count("imageUrl"), count(price), count("listPrice") FROM "Product";`
Expected: 세 값 모두 30(전체).

**Step 5: Commit**

```bash
git add apps/api/scripts/backfill-demo-media.ts apps/api/package.json apps/web/public/products
git commit -m "chore(api): 데모용 이미지/가격 백필 스크립트(vitaminshop) + 산출물"
```

> ⚠️ `apps/web/public/products/*.jpg`를 커밋에 포함할지 여부: 데모 재현성을 위해 **포함 권장**(빌드 시 재스크랩 불필요). 용량이 문제면 `.gitignore` 후 README에 `backfill:demo` 실행 안내.

---

## Task 5: 라우팅 정리 — `/check` → `/` 리다이렉트, 중복 페이지 제거

**Files:**
- Delete: `apps/web/src/app/[locale]/(checker)/check/page.tsx` (CheckPage 본문 — 곧 `/`로 통합)
- Create: `apps/web/src/app/[locale]/(checker)/check/page.tsx` (리다이렉트 stub)
- 확인: `apps/web/src/app/[locale]/(checker)/page.tsx`가 홈 `/`의 체커 (Task 6~8에서 재작성)

**Step 1: `/check` 리다이렉트 stub로 교체**

```tsx
// apps/web/src/app/[locale]/(checker)/check/page.tsx
import { redirect } from 'next/navigation';

// 체커는 홈 `/`으로 통합됨. 구 경로는 홈으로 리다이렉트.
export default function CheckRedirect() {
  redirect('/');
}
```

**Step 2: dev 서버 재시작(이전 stale "two parallel pages" 컴파일 해제)**

사용자 tmux의 dev 프로세스를 Ctrl-C 후 `make dev-web` 재실행. (필요시 `rm -rf apps/web/.next`.)

**Step 3: 라우팅 확인**

`http://127.0.0.1:3000/` → 체커, `http://127.0.0.1:3000/check` → `/`로 리다이렉트, 500 없음.

**Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/(checker)/check/page.tsx"
git commit -m "fix(web): /check를 홈 /으로 리다이렉트 (이중 마운트 정리)"
```

---

## Task 6: 커머스형 `ProductCard` + `ProductGrid` (Image #1 구조)

기존 `ProductPicker`를 vitaminshop 스타일 카드 그리드로 교체.

**Files:**
- Create: `apps/web/src/components/checker/format.ts` (가격/할인 포맷 유틸)
- Create: `apps/web/src/components/checker/ProductCard.tsx`
- Modify: `apps/web/src/components/checker/ProductPicker.tsx` (그리드 래퍼 — ProductCard 사용)

**Step 1: 포맷 유틸**

```ts
// apps/web/src/components/checker/format.ts
export function formatKRW(value: number | null): string | null {
  if (value == null) return null;
  return `${value.toLocaleString('ko-KR')}원`;
}
// 할인율 % (정상가/판매가 모두 있을 때만)
export function discountPercent(listPrice: number | null, price: number | null): number | null {
  if (listPrice == null || price == null || listPrice <= 0 || price >= listPrice) return null;
  return Math.round(((listPrice - price) / listPrice) * 100);
}
```

**Step 2: `ProductCard` 작성** (이미지+가격+할인+담기, SVG 아이콘)

```tsx
'use client';

import Image from 'next/image';
import type { CatalogProduct } from '@/libs/Api';
import { discountPercent, formatKRW } from './format';

type Props = { product: CatalogProduct; selected: boolean; onToggle: (id: number) => void };

export function ProductCard({ product, selected, onToggle }: Props) {
  const list = formatKRW(product.listPrice);
  const sale = formatKRW(product.price);
  const off = discountPercent(product.listPrice, product.price);

  return (
    <button
      type="button"
      onClick={() => onToggle(product.id)}
      aria-pressed={selected}
      className={`group flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border text-left transition duration-200 ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      {/* 이미지 영역: 파스텔 라운드 배경 */}
      <div className="relative aspect-square w-full bg-gradient-to-br from-blue-50 to-indigo-50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width:640px) 50vw, 25vw"
            className="object-contain p-4"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">이미지 없음</div>
        )}
        {/* 우하단 담기 아이콘 (Heroicons shopping-bag, 이모지 X) */}
        <span
          className={`absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full shadow-sm transition-colors ${
            selected ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 group-hover:text-blue-600'
          }`}
          aria-hidden="true"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12A1.125 1.125 0 0119.748 21H4.252a1.125 1.125 0 01-1.121-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
        </span>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="line-clamp-2 min-h-[2.5rem] font-semibold text-gray-900">{product.name}</p>
        {list && off != null && <p className="text-sm text-gray-400 line-through">{list}</p>}
        <p className="flex items-baseline gap-2">
          {sale && <span className="text-lg font-bold text-gray-900">{sale}</span>}
          {off != null && <span className="text-sm font-bold text-red-600">{off}%</span>}
        </p>
        <div className="mt-1 flex flex-wrap gap-1 text-xs text-gray-500">
          {product.form && <span className="rounded bg-gray-100 px-2 py-0.5">{product.form}</span>}
          {product.targetAgeLabel && (
            <span className="rounded bg-gray-100 px-2 py-0.5">{product.targetAgeLabel}</span>
          )}
        </div>
        <span className="mt-2 inline-flex w-fit rounded-md px-2 py-1 text-sm font-medium"
          /* 선택 상태 라벨 (색 단독 신호 금지) */
        >
          {selected ? '✓ 담음' : '담기'}
        </span>
      </div>
    </button>
  );
}
```

**Step 3: `ProductPicker`를 그리드 래퍼로 단순화**

```tsx
'use client';
import type { CatalogProduct } from '@/libs/Api';
import { ProductCard } from './ProductCard';

type Props = { products: CatalogProduct[]; selectedIds: number[]; onToggle: (id: number) => void };

export function ProductPicker({ products, selectedIds, onToggle }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} selected={selectedIds.includes(p.id)} onToggle={onToggle} />
        </li>
      ))}
    </ul>
  );
}
```

**Step 4: next/image 로컬 이미지 확인**

`/products/pNN.jpg`는 `public/` 자산이므로 `remotePatterns` 불필요. 만약 라이브 원격 URL을 쓰면 `next.config.ts`에 `images.remotePatterns` 추가 필요(이 계획은 로컬 다운로드 전제 → 불필요).

**Step 5: 타입체크 + 린트**

Run: `pnpm --filter @levit/web check:types && pnpm --filter @levit/web lint`
Expected: PASS.

**Step 6: Commit**

```bash
git add apps/web/src/components/checker/format.ts apps/web/src/components/checker/ProductCard.tsx apps/web/src/components/checker/ProductPicker.tsx
git commit -m "feat(web): 커머스형 ProductCard 그리드(이미지·가격·할인·담기)"
```

---

## Task 7: 스텝퍼 + 하단 스티키 카트바로 `/` 페이지 재구성

`(checker)/page.tsx`를 4단계 스텝 흐름으로 재작성. 기존 상태/핸들러(getProducts, toggleCart, runAnalyze 등)는 재사용하되 `step` 상태 추가, 단계별 화면 분기, 하단 스티키 카트바 추가.

**Files:**
- Modify: `apps/web/src/app/[locale]/(checker)/page.tsx`
- Create: `apps/web/src/components/checker/StepProgress.tsx`
- Create: `apps/web/src/components/checker/StickyCartBar.tsx`

**Step 1: `StepProgress` (상단 진행 표시)**

```tsx
'use client';
const STEPS = ['상황', '제품', '나이', '결과'];
export function StepProgress({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="진행 단계">
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={state === 'active' ? 'step' : undefined}
              className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                state === 'todo' ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm ${state === 'active' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-gray-200" />}
          </li>
        );
      })}
    </ol>
  );
}
```

**Step 2: `StickyCartBar` (하단 고정)**

```tsx
'use client';
type Props = { count: number; previewNames: string[]; ctaLabel: string; onCta: () => void; disabled?: boolean };
export function StickyCartBar({ count, previewNames, ctaLabel, onCta, disabled }: Props) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">담은 제품 {count}개</p>
          <p className="truncate text-xs text-gray-500">{previewNames.join(', ')}</p>
        </div>
        <button
          type="button"
          onClick={onCta}
          disabled={disabled}
          className="shrink-0 cursor-pointer rounded-lg bg-blue-600 px-5 py-2 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: 페이지 스텝 머신으로 재작성**

`page.tsx`에 `const [step, setStep] = useState(0)` 추가 (0:상황,1:제품,2:나이,3:결과). 핵심:
- step 0: `<PersonaLanding onSelect={...}/>` (Task 8에서 세트 카드화). 선택 시 프리필 후 `setStep(1)`.
- step 1: `<ProductPicker .../>`. 스티키바 CTA "다음: 나이 입력 →" → `setStep(2)`.
- step 2: `<AgeStep .../>`. 제출(`runAnalyze`) 성공 시 `setStep(3)`.
- step 3: `<RecommendedSetCard/>` + `<ReportCard/>` + "추가하기"(기존 로직).
- 상단 `<StepProgress current={step} />`. 본문 하단 패딩(`pb-28`)으로 스티키바와 겹침 방지.
- 스티키바: step 1~2에서 노출, CTA는 step에 따라 분기. step 2는 AgeStep 자체 제출 버튼과 중복되므로 스티키바는 "담은 제품 요약"만(또는 step 1에서만 CTA 노출) — 단순화: **step 1에서만 "다음 →" CTA**, 나머지는 요약만.
- "상황 다시 고르기" = `setStep(0)` + 기존 `backToLanding` 상태 초기화.

> 기존 `entry` 상태(`'landing'|'checker'`)는 `step`으로 대체. `getProducts` useEffect, `toggleCart`, `runAnalyze`, `reAnalyze`, `cartProducts` 계산은 그대로 유지.

**Step 4: 타입체크 + 린트 + 수동 확인**

Run: `pnpm --filter @levit/web check:types && pnpm --filter @levit/web lint`
수동: `127.0.0.1:3000`에서 4단계 진행, 스티키바 동작, 375/768/1024/1440 뷰포트 확인.

**Step 5: Commit**

```bash
git add "apps/web/src/app/[locale]/(checker)/page.tsx" apps/web/src/components/checker/StepProgress.tsx apps/web/src/components/checker/StickyCartBar.tsx
git commit -m "feat(web): 체커를 4단계 스텝퍼 + 스티키 카트바로 재구성"
```

---

## Task 8: 페르소나를 "테마 세트" 커머스 카드로 (Image #2)

step 0(상황 고르기)의 페르소나 카드를 세트 상품풍으로 다듬는다. 새 DB 엔티티 없이 `personaScenarios.ts` 재활용.

**Files:**
- Modify: `apps/web/src/components/checker/personaScenarios.ts` (세트명/설명 라벨 보강)
- Modify: `apps/web/src/components/checker/PersonaLanding.tsx` (세트 카드 표현: 포함 제품 수, 연령 라벨, "이 세트로 시작" CTA)

**Step 1: 세트 메타 보강**

`PersonaScenario`에 선택적 `setName?`(예: "5~8세 면역 케어 세트")와 기존 `pain`/`hint` 활용. 비파괴적 추가.

**Step 2: PersonaLanding 카드 표현 변경**

각 카드에 세트명, 포함 제품 수(`productNames.length`), 연령(`ageYears`) 노출. 클릭 시 동일하게 `onSelect(scenario)`. `manual`은 "직접 담기" 카드 유지.

**Step 3: 타입체크 + 린트 + 수동 확인**

Run: `pnpm --filter @levit/web check:types && pnpm --filter @levit/web lint`

**Step 4: Commit**

```bash
git add apps/web/src/components/checker/personaScenarios.ts apps/web/src/components/checker/PersonaLanding.tsx
git commit -m "feat(web): 페르소나를 테마 세트 카드로 표현(커머스형 진입)"
```

---

## Task 9: 비주얼 마감 + 이모지→SVG + 접근성/반응형 점검

**Files:**
- Modify: `apps/web/src/components/checker/ReportCard.tsx` (판정 이모지 🟢🟡🔴⚪ → 색칩 + 텍스트 라벨 유지, 필요시 SVG dot)
- Modify: 잔여 이모지 사용처(예: `RecommendedSetCard`의 ✅, `page.tsx`의 ➕) 점검

**Step 1: 판정 표시 점검**

`VERDICT_STYLE`의 `icon` 이모지는 색 단독 신호 방지를 위해 **텍스트 라벨과 병기되어 있으므로 유지 가능**. 일관성을 위해 색 dot(`<span class="size-2 rounded-full ...">`)+라벨로 교체 권장(선택). 최소 변경: 그대로 두되, 클릭형 요소의 ➕ 등 UI 아이콘만 SVG로.

**Step 2: 접근성/반응형 체크리스트**

- [ ] 모든 클릭 요소 `cursor-pointer`, 포커스 링
- [ ] 가격 할인 빨강이 색 단독 신호가 아님(라벨 동반)
- [ ] `prefers-reduced-motion` 존중(과한 애니메이션 없음)
- [ ] 375/768/1024/1440 가로 스크롤 없음, 그리드 2→4열 전환
- [ ] 이미지 `alt`(상품명), 스티키바가 본문 가리지 않음(`pb-28`)

**Step 3: 전체 검증**

Run: `pnpm --filter @levit/web check:types && pnpm --filter @levit/web lint && pnpm --filter @levit/api test`
Expected: 모두 PASS (특히 API 룰/판정 테스트 그린 = 회귀 없음).

**Step 4: Commit**

```bash
git add -A
git commit -m "polish(web): 아이콘/접근성/반응형 마감"
```

---

## Task 10: 결정 로그 + 최종 검증

**Files:**
- Modify: `docs/submission/engineering-decisions.md`

**Step 1: 결정 로그 추가** (3줄 형식)

```
## 2026-05-30 커머스형 체커 화면 재구성
- 요구사항: 유저 시퀀스(상황→제품→나이→결과) 단계화 + 실제 커머스(vitaminshop)처럼 상품 진열.
- 고민: 이미지/가격 데이터 부재(전부 NULL), 타사 자산 사용의 정직성, 룰 엔진 무오염 보장.
- 해결: 데모 더미(로컬 다운로드 이미지 + 결정적 랜덤 가격) 백필, 표시 전용으로 격리(판정 무관), 스텝퍼+스티키 카트바로 시퀀스 명확화.
```

**Step 2: 최종 검증 (verification-before-completion)**

Run:
- `pnpm --filter @levit/api test` → PASS
- `pnpm --filter @levit/web check:types` → PASS
- `pnpm --filter @levit/web lint` → PASS
- 수동: `/` 4단계 플로우 + `/check` 리다이렉트 + 4뷰포트

**Step 3: Commit**

```bash
git add docs/submission/engineering-decisions.md
git commit -m "docs: 커머스형 체커 재구성 결정 로그"
```

---

## 부록: 비범위 / 주의

- **룰 엔진/`/analyze`/`verify-explanation` 무변경.** 가격·이미지는 표시 전용.
- next-intl 카탈로그화 안 함(하드코딩 한국어 유지).
- 실제 결제·재고 없음. 세트는 페르소나 프리셋 재활용.
- 타사 이미지/가격은 데모 한정 — 운영 전환 시 자체 자산/가격으로 교체 필요.
