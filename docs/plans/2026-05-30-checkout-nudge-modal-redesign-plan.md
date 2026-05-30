# 결제 넛지 모달 2단계 재구성 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `결제하기` → 모달이 ① 아이 나이를 확인하고 → ② "AI가 분석했어요" 간단 요약(+자세히 보기)으로 중복·과다를 알려주도록 재구성한다.

**Architecture:** 프론트엔드만 수정, 백엔드/API/DB 무변경. 기존 `POST /analyze` 응답(`byNutrient[]`)만으로 결과를 구성한다. 안전 판정은 전적으로 룰 엔진 결과를 신뢰하고(표시만 가공), AI 종합 문단은 새 LLM 호출 없이 판정으로 클라이언트에서 조합한다. 성분별 실제 LLM 설명·근거는 기존 `ReportCard`를 '자세히 보기'에 그대로 재사용해 "간단함 + 신뢰" 둘 다 유지.

**Tech Stack:** Next.js 16 (App Router, `'use client'`), React 19, Tailwind v4, Vitest(웹 단위 테스트), 기존 NestJS `/analyze` API.

**설계 출처:** `docs/plans/2026-05-30-checkout-nudge-modal-redesign-design.md`

---

## 사전 준비 (실행 전 1회)

```bash
# 의존성 설치 (clerk/vite 타입 미해결 에러는 미설치가 원인 — 설치하면 사라짐)
pnpm install
```

검증 명령(반복 사용):
- 웹 타입체크: `pnpm --filter @levit/web check:types`
- 웹 린트: `pnpm --filter @levit/web lint`
- 웹 단위테스트: `pnpm --filter @levit/web exec vitest run --project unit nudgeSummary`
- API 회귀(무변경 확인): `pnpm --filter @levit/api test`
- 수동 e2e: `make dev-web` + `make dev-api` 후 **`http://localhost:3000`** 접속 (⚠️ dev는 IPv6 `localhost` 바인딩 — `127.0.0.1` 아님)

---

## Task 1: 판정 스타일 상수 공유화 (DRY 리팩터)

`VERDICT_STYLE`이 `ReportCard.tsx`에 갇혀 있어 모달 1줄 리스트에서 재사용 불가. 공용 모듈로 추출한다.

**Files:**
- Create: `apps/web/src/components/checker/verdictStyle.ts`
- Modify: `apps/web/src/components/checker/ReportCard.tsx` (지역 상수 → import)

**Step 1: 공용 상수 파일 생성**

`apps/web/src/components/checker/verdictStyle.ts`:
```ts
import type { Verdict } from '@/libs/Api';

// 색상은 단독 신호가 아니다 — 라벨 + 이모지 + 텍스트를 함께 제공해 접근성을 확보한다.
export const VERDICT_STYLE: Record<
  Verdict,
  { label: string; icon: string; card: string; badge: string }
> = {
  SAFE: {
    label: '안전',
    icon: '🟢',
    card: 'border-green-300 bg-green-50',
    badge: 'bg-green-600 text-white',
  },
  DUPLICATE: {
    label: '중복 · 범위내',
    icon: '🟡',
    card: 'border-amber-300 bg-amber-50',
    badge: 'bg-amber-500 text-white',
  },
  OVER: {
    label: '과다',
    icon: '🔴',
    card: 'border-red-300 bg-red-50',
    badge: 'bg-red-600 text-white',
  },
  UNKNOWN: {
    label: '확인불가',
    icon: '⚪',
    card: 'border-gray-300 bg-gray-50',
    badge: 'bg-gray-500 text-white',
  },
};
```

**Step 2: ReportCard에서 지역 `VERDICT_STYLE` 정의 삭제 + import**

`ReportCard.tsx` 상단 `import type {...}` 다음 줄에 추가:
```ts
import { VERDICT_STYLE } from './verdictStyle';
```
그리고 파일 안의 `const VERDICT_STYLE: Record<...> = { ... };` 블록(약 7~35행) 전체 삭제.

**Step 3: 타입체크 + 린트**

Run: `pnpm --filter @levit/web check:types && pnpm --filter @levit/web lint`
Expected: 통과 (touched 파일에 새 에러 0)

**Step 4: Commit**

```bash
git add apps/web/src/components/checker/verdictStyle.ts apps/web/src/components/checker/ReportCard.tsx
git commit -m "refactor(web): VERDICT_STYLE 공용 모듈로 추출"
```

---

## Task 2: 종합 문단·1줄 헬퍼 (TDD)

순수 함수 2개. AI 종합 문단(`composeSummary`)과 1줄 권장/현재 텍스트(`formatNutrientLine`).

**Files:**
- Create: `apps/web/src/components/checker/nudgeSummary.ts`
- Test: `apps/web/src/components/checker/nudgeSummary.test.ts`

**Step 1: 실패하는 테스트 작성**

`apps/web/src/components/checker/nudgeSummary.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { AnalyzeResponse, NutrientResult, Verdict } from '@/libs/Api';
import { composeSummary, formatNutrientLine } from './nudgeSummary';

function nutrient(name: string, verdict: Verdict, over: Partial<NutrientResult> = {}): NutrientResult {
  return {
    ingredientId: 1,
    ingredientName: name,
    totalCanonical: 10,
    unit: '㎍',
    productCount: 1,
    recommended: 10,
    upperLimit: 100,
    percentOfRecommended: 100,
    verdict,
    reference: null,
    explanation: '',
    ...over,
  };
}
const report = (ns: NutrientResult[]): AnalyzeResponse => ({ byNutrient: ns, disclaimer: 'x' });

describe('composeSummary', () => {
  it('모두 SAFE면 적정 범위 문장', () => {
    const s = composeSummary(report([nutrient('비타민C', 'SAFE')]), 5, 2);
    expect(s).toBe('구매하신 2개 제품을 분석했어요. 만 5세 기준 모든 성분이 적정 범위예요.');
  });

  it('OVER 성분은 상한 초과 주의로 명시', () => {
    const s = composeSummary(report([nutrient('비타민D', 'OVER')]), 5, 1);
    expect(s).toContain('확인이 필요해요');
    expect(s).toContain('비타민D 상한 초과 주의');
  });

  it('DUPLICATE / UNKNOWN 각각 표기', () => {
    const s = composeSummary(
      report([nutrient('철', 'DUPLICATE'), nutrient('셀레늄', 'UNKNOWN')]),
      7,
      3,
    );
    expect(s).toContain('철 겹침');
    expect(s).toContain('셀레늄 기준 없음(확인불가)');
  });
});

describe('formatNutrientLine', () => {
  it('recommended=null이면 "권장 기준 없음"', () => {
    const r = formatNutrientLine(nutrient('X', 'UNKNOWN', { recommended: null }));
    expect(r.recommended).toBe('권장 기준 없음');
  });

  it('권장/현재 포맷', () => {
    const r = formatNutrientLine(
      nutrient('비타민C', 'SAFE', { recommended: 35, totalCanonical: 30, unit: 'mg' }),
    );
    expect(r.recommended).toBe('권장 35mg');
    expect(r.current).toBe('지금 30mg');
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @levit/web exec vitest run --project unit nudgeSummary`
Expected: FAIL ("Cannot find module './nudgeSummary'" 또는 export 없음)

**Step 3: 최소 구현**

`apps/web/src/components/checker/nudgeSummary.ts`:
```ts
import type { AnalyzeResponse, NutrientResult } from '@/libs/Api';

/** 결과 상단 '🤖 종합' 문단 — 룰 엔진 판정만으로 조합(LLM 호출 없음). */
export function composeSummary(
  report: AnalyzeResponse,
  ageYears: number,
  productCount: number,
): string {
  const by = report.byNutrient;
  const head = `구매하신 ${productCount}개 제품을 분석했어요. 만 ${ageYears}세 기준 `;
  const over = by.filter((n) => n.verdict === 'OVER').map((n) => n.ingredientName);
  const dup = by.filter((n) => n.verdict === 'DUPLICATE').map((n) => n.ingredientName);
  const unknown = by.filter((n) => n.verdict === 'UNKNOWN').map((n) => n.ingredientName);

  const parts: string[] = [];
  if (over.length > 0) {
    parts.push(`${over.join(' · ')} 상한 초과 주의`);
  }
  if (dup.length > 0) {
    parts.push(`${dup.join(' · ')} 겹침`);
  }
  if (unknown.length > 0) {
    parts.push(`${unknown.join(' · ')} 기준 없음(확인불가)`);
  }

  if (parts.length === 0) {
    return `${head}모든 성분이 적정 범위예요.`;
  }
  return `${head}확인이 필요해요 — ${parts.join(', ')}.`;
}

/** 성분 1줄 표시용 권장/현재 텍스트. */
export function formatNutrientLine(n: NutrientResult): { recommended: string; current: string } {
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    recommended: n.recommended === null ? '권장 기준 없음' : `권장 ${round(n.recommended)}${n.unit}`,
    current: n.totalCanonical === null ? '-' : `지금 ${round(n.totalCanonical)}${n.unit}`,
  };
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @levit/web exec vitest run --project unit nudgeSummary`
Expected: PASS (5 passed)

**Step 5: Commit**

```bash
git add apps/web/src/components/checker/nudgeSummary.ts apps/web/src/components/checker/nudgeSummary.test.ts
git commit -m "feat(web): 넛지 종합문단·성분 1줄 헬퍼(+테스트)"
```

---

## Task 3: checkout 페이지에서 나이 입력 제거 + 모달에 prefill 전달

**Files:**
- Modify: `apps/web/src/app/[locale]/(checker)/page.tsx`

**Step 1: checkout 뷰의 나이 입력 블록 삭제**

`page.tsx`에서 `<div className="mt-6 rounded-xl border border-gray-200 p-4">` ~ 닫는 `</div>`까지 (나이 `label`+`input` 블록, 약 308~332행) **전체 삭제**.

**Step 2: 결제 버튼 게이팅 제거**

같은 파일의 결제 버튼을 아래로 교체(나이 무관·항상 활성):
```tsx
<button
  className="mt-6 w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-3 text-lg font-bold text-white transition hover:bg-blue-700"
  onClick={() => {
    setNudgeOpen(true);
  }}
  type="button"
>
  {formatKRW(total)} 결제하기
</button>
```
바로 아래 `{!ageValid && ( ... 결제하려면 아이 나이를 ... )}` 블록 삭제.

**Step 3: 모달 렌더 조건·props 교체**

`{nudgeOpen && ageValid && (` → `{nudgeOpen && (` 로 변경하고, `NudgeModal`에 넘기는 `ageYears={childAge}` 를 **`initialAgeYears={ageValid ? ageYears : null}`** 로 교체. (`ageInput`/`ageYears`/`ageValid` 계산은 페르소나 prefill 용도로 그대로 유지. `childAge` 변수는 더 안 쓰면 삭제.)

```tsx
{nudgeOpen && (
  <NudgeModal
    initialAgeYears={ageValid ? ageYears : null}
    onAdjust={() => {
      setNudgeOpen(false);
      setView('shop');
    }}
    onClose={() => {
      setNudgeOpen(false);
    }}
    onConfirmPay={() => {
      setNudgeOpen(false);
      setView('done');
    }}
    productIds={cart}
  />
)}
```

> 참고: 이 단계에서 `NudgeModal` props 시그니처가 바뀌므로 Task 4 적용 전까지 타입 에러가 날 수 있음 — Task 3·4는 연속 적용 후 한 번에 타입체크해도 됨. 커밋은 Task 4 끝에서 함께.

**Step 4: (Task 4와 함께) 타입체크 + 린트 + 수동 확인**

수동: checkout 화면에 나이 입력칸이 없고 `결제하기`가 바로 눌리는지 확인.

---

## Task 4: NudgeModal 2단계화 (STEP1 나이 확인 → STEP2 간단 결과)

`NudgeModal.tsx` 전체를 아래로 교체.

**Files:**
- Modify (전체 교체): `apps/web/src/components/checker/NudgeModal.tsx`

**Step 1: 새 NudgeModal 작성**

```tsx
'use client';

import { useState } from 'react';
import type { AnalyzeResponse } from '@/libs/Api';
import { analyze, ApiError } from '@/libs/Api';
import { composeSummary, formatNutrientLine } from './nudgeSummary';
import { RecommendedSetCard } from './RecommendedSetCard';
import { ReportCard } from './ReportCard';
import { VERDICT_STYLE } from './verdictStyle';

type Props = {
  initialAgeYears: number | null;
  productIds: number[];
  onClose: () => void; // 닫기 → checkout 유지
  onAdjust: () => void; // 상품 다시 담기 → 목록
  onConfirmPay: () => void; // 결제 → 완료
};

export function NudgeModal({ initialAgeYears, productIds, onClose, onAdjust, onConfirmPay }: Props) {
  const [step, setStep] = useState<'age' | 'result'>('age');
  const [ageInput, setAgeInput] = useState(initialAgeYears === null ? '' : String(initialAgeYears));
  const [report, setReport] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const ageNum = ageInput.trim() === '' ? null : Number(ageInput);
  const ageValid = ageNum !== null && !Number.isNaN(ageNum) && ageNum >= 0 && ageNum <= 18;
  const ageYears = ageValid ? ageNum : 0;

  const runAnalyze = async () => {
    if (!ageValid) {
      return;
    }
    setStep('result');
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await analyze({ ageMonths: Math.round(ageYears * 12), productIds });
      setReport(r);
    } catch (error) {
      setErrorMsg(error instanceof ApiError ? error.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const hasRisk =
    report?.byNutrient.some((n) => n.verdict === 'OVER' || n.verdict === 'DUPLICATE') ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="닫기"
        className="absolute inset-0 cursor-pointer bg-black/50"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby="nudge-title"
        aria-modal="true"
        className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
      >
        {step === 'age' && (
          <div className="px-6 py-6">
            <h2 className="text-2xl font-bold text-gray-900" id="nudge-title">
              잠깐, 아이 나이를 확인할게요
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {initialAgeYears === null
                ? '결제 전, 만 나이 기준으로 중복·과다를 분석해 드려요.'
                : `혹시 만 ${initialAgeYears}세가 맞나요? 아니면 고쳐 주세요.`}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <input
                aria-label="아이 나이 (만 나이)"
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                inputMode="numeric"
                max={18}
                min={0}
                onChange={(e) => {
                  setAgeInput(e.target.value);
                }}
                placeholder="예: 5"
                type="number"
                value={ageInput}
              />
              <span className="text-base text-gray-600">세</span>
            </div>
            <button
              className="mt-6 w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-3 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!ageValid}
              onClick={() => {
                void runAnalyze();
              }}
              type="button"
            >
              이 나이로 분석하기
            </button>
            {!ageValid && (
              <p className="mt-2 text-center text-xs text-gray-400">만 나이(0~18)를 입력해 주세요.</p>
            )}
          </div>
        )}

        {step === 'result' && (
          <>
            <div className="border-b border-gray-100 px-6 pt-6 pb-4">
              <h2 className="text-2xl font-bold text-gray-900" id="nudge-title">
                내 아이한테 지금 맞을까요?
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                만 {ageYears}세 · 담은 {productIds.length}개 제품 기준
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
                  <span className="size-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                  <p className="text-sm">안전하게 확인하는 중…</p>
                </div>
              )}

              {errorMsg && !loading && (
                <div className="flex flex-col gap-3" role="alert">
                  <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {errorMsg}
                  </p>
                  <button
                    className="cursor-pointer self-start rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      void runAnalyze();
                    }}
                    type="button"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {report && !loading && (
                <div className="flex flex-col gap-4">
                  {/* ① 종합 배너 */}
                  {hasRisk ? (
                    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
                      <p className="text-lg font-bold text-red-800">⚠️ 잠깐만요, 확인이 필요해요</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4">
                      <p className="text-lg font-bold text-green-800">✅ 안전하게 구성됐어요</p>
                    </div>
                  )}

                  {/* ② AI 종합 문단 (룰 조합) */}
                  <p className="rounded-xl bg-blue-50/70 p-4 text-sm leading-relaxed text-gray-800">
                    🤖 {composeSummary(report, ageYears, productIds.length)}
                  </p>

                  {/* 위험 시 검증된 세트 (OVER 없으면 컴포넌트가 자동 null) */}
                  <RecommendedSetCard ageYears={ageYears} report={report} />

                  {/* ③ 성분별 1줄 (전부 나열) */}
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-gray-900">성분별 권장량</p>
                    {report.byNutrient.map((n) => {
                      const line = formatNutrientLine(n);
                      const style = VERDICT_STYLE[n.verdict];
                      return (
                        <div
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                          key={n.ingredientId}
                        >
                          <span className="font-medium text-gray-900">
                            {style.icon} {n.ingredientName}
                          </span>
                          <span className="text-gray-600">
                            {line.recommended} · {line.current}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* ④ 자세히 보기 → 기존 상세 ReportCard */}
                  <button
                    className="cursor-pointer self-start text-sm font-semibold text-blue-700 hover:underline"
                    onClick={() => {
                      setShowDetail((v) => !v);
                    }}
                    type="button"
                  >
                    {showDetail ? '▾ 자세히 닫기' : '▸ 자세히 보기 (상한·근거·설명)'}
                  </button>
                  {showDetail && <ReportCard report={report} />}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
              {hasRisk ? (
                <>
                  <button
                    className="flex-1 cursor-pointer rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-blue-700"
                    onClick={onAdjust}
                    type="button"
                  >
                    상품 다시 담기
                  </button>
                  <button
                    className="cursor-pointer rounded-lg border border-gray-300 px-4 py-3 text-base font-semibold text-gray-600 transition hover:bg-gray-50"
                    onClick={onConfirmPay}
                    type="button"
                  >
                    그래도 결제
                  </button>
                </>
              ) : (
                <button
                  className="flex-1 cursor-pointer rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  disabled={loading}
                  onClick={onConfirmPay}
                  type="button"
                >
                  안전해요, 결제하기
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: 타입체크 + 린트 (Task 3 변경분 포함)**

Run: `pnpm --filter @levit/web check:types && pnpm --filter @levit/web lint`
Expected: 통과 (touched 파일에 새 에러 0). `RecommendedSetCard`/`ReportCard`/`AnalyzeResponse` import 정상.

**Step 3: 수동 e2e — STEP 흐름**

`make dev-web` + `make dev-api`, **`http://localhost:3000`**:
- 상품 담기 → 🛒 → checkout(나이칸 없음 확인) → `결제하기`
- 모달 STEP1: 나이칸 표시(페르소나로 들어왔으면 prefill). "이 나이로 분석하기" → 로딩 → STEP2.
- STEP2: 종합 배너 + 🤖 문단 + 성분별 1줄(전부) + 자세히 보기 토글로 ReportCard 펼침.

**Step 4: Commit (Task 3 + Task 4 함께)**

```bash
git add "apps/web/src/app/[locale]/(checker)/page.tsx" apps/web/src/components/checker/NudgeModal.tsx
git commit -m "feat(web): 결제 넛지 모달 2단계화(나이 확인→간단 결과)"
```

---

## Task 5: 안전/위험 두 경로 + 회귀 검증

**Files:** (검증 전용 — 코드 수정은 발견 시에만)

**Step 1: 안전 케이스 수동 확인**
- 단일 제품(겹침 없는 것) 담고 결제 → STEP2 ✅ 배너, 🤖 "모든 성분이 적정 범위" 문단, `RecommendedSetCard` 미노출, 버튼 `안전해요, 결제하기` → 결제완료.

**Step 2: 위험 케이스 수동 확인**
- 과다 페르소나(P3) 또는 같은 성분 제품 2~3개 담기 → STEP2 ⚠️ 배너, 🤖 "확인이 필요해요 — …" 문단, `RecommendedSetCard` 노출, 버튼 `상품 다시 담기`·`그래도 결제` 분기.
- `자세히 보기` 펼쳐 상한·근거 링크·LLM 설명 보이는지 확인.

**Step 3: 단위테스트 + 타입 + 린트 일괄**

Run:
```bash
pnpm --filter @levit/web exec vitest run --project unit nudgeSummary
pnpm --filter @levit/web check:types
pnpm --filter @levit/web lint
```
Expected: 전부 통과.

**Step 4: API 회귀 (무변경 확인)**

Run: `pnpm --filter @levit/api test`
Expected: 기존 테스트 전부 PASS (백엔드 미변경이므로 회귀 0).

**Step 5: 발견된 수정만 커밋**

```bash
git add -A
git commit -m "test(web): 넛지 모달 안전/위험 경로 수동검증 + 회귀 확인"
```
(수정 없으면 커밋 생략)

---

## Task 6: 결정 로그 + 마무리

**Files:**
- Modify: `docs/submission/engineering-decisions.md`

**Step 1: 결정 로그 항목 추가**

`engineering-decisions.md` 끝에 `## 06. 결제 넛지 모달 2단계 재구성 (2026-05-30)` 항목 추가 — `요구사항 / 고민 / 해결` 3줄 (나이를 모달 STEP1로 이동, 결과는 간단 요약+자세히보기, AI 종합문단은 룰 조합으로 LLM 추가호출 0, 백엔드 무변경).

**Step 2: Commit**

```bash
git add docs/submission/engineering-decisions.md
git commit -m "docs: engineering-decisions #06 (넛지 모달 2단계)"
```

---

## 완료 기준 (Definition of Done)

- [ ] checkout 페이지에 나이 입력칸 없음, `결제하기` 항상 활성
- [ ] 모달 STEP1에서 나이 확인(페르소나 prefill 반영) 후 분석 진입
- [ ] STEP2: 종합 배너 + 🤖 룰 조합 문단 + 성분별 1줄(전부) + 자세히 보기(ReportCard)
- [ ] 위험 시 `RecommendedSetCard` 노출 + 버튼 분기, 안전 시 단일 결제 버튼
- [ ] `nudgeSummary` 단위테스트 그린, 웹 tsc·lint 통과, API 56 테스트 그린(회귀 0)
- [ ] 안전·위험 두 경로 수동 e2e 확인 (localhost)
```
