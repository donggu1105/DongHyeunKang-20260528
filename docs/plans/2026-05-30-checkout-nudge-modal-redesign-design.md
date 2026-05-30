# 결제 직전 넛지 모달 재구성 — 2단계(나이 확인 → 간단 분석) 설계

- 날짜: 2026-05-30
- 범위: **프론트엔드만**. 백엔드/API/DB **무변경** (기존 `POST /analyze` 재사용).
- 관련 파일: `apps/web/src/app/[locale]/(checker)/page.tsx`, `apps/web/src/components/checker/NudgeModal.tsx` (+ 기존 `ReportCard`/`RecommendedSetCard`/`format.ts` 재사용)

## 배경 / 문제

현재 플로우: 나이를 **checkout 페이지**에서 입력(필수 게이팅) → `결제하기` → `NudgeModal`이 열리자마자 `/analyze` 호출 → **성분별 상세 카드(ReportCard)** 로 빽빽하게 결과 표시.

원하는 경험: `결제하기`를 누르면 **모달이 뜨면서 먼저 아이 나이를 확인**("혹시 몇 살이 맞나요?")하고, 그다음 **간단하게** "구매하신 제품을 AI가 분석해 드리고, 적정한지·얼마나 먹어야 하는지" 알려주는 흐름.

## 결정 사항 (브레인스토밍 합의)

1. **나이 입력 위치**: checkout 페이지 입력칸 제거 → **모달 1단계**로 이동. 페르소나 선택값은 prefill.
2. **결과 표현**: **간단 요약 + '자세히 보기' 펼치기**. 기본은 종합판정 + AI 한 문단 + 성분별 1줄 권장량. '자세히'에 기존 상세 `ReportCard`(상한·근거 링크·실제 LLM 설명) 보존 → "간단함"과 "신뢰(근거)" 둘 다 유지.
3. **AI 종합 문단**: 새 LLM 호출 없이 **룰 엔진 판정으로 클라이언트가 즉석 조합** (비용 0·즉시·환각 불가). 성분별 실제 LLM 설명은 '자세히 보기'에 그대로.
4. **성분 1줄 리스트**: SAFE 포함 **전부 나열**(접지 않음).
5. **`RecommendedSetCard`(안전 세트 교체 유도)**: **위험 시에만** 노출. (안전 시엔 교체할 게 없어 숨김 — 추후 켜기 쉬움)

## 새 플로우

```
[checkout] 장바구니
  ├─ 합계만 표시 (나이 입력칸 제거)
  └─ "결제하기" (cart>0면 항상 활성)
        │ 클릭 → 모달 open (step='age')
        ▼
[NudgeModal] 내부 2단계
  ── STEP 1 (age) ──
     "잠깐, 아이 나이를 확인할게요"
     prefill 있으면: "혹시 만 5세 맞나요? 아니면 고쳐주세요"
     prefill 없으면: "아이가 몇 살인가요? (만 나이)"
     [이 나이로 분석하기]  (0~18 유효할 때만 활성)
        │ → /analyze(ageMonths=round(years*12), productIds), 로딩
        ▼
  ── STEP 2 (result) ── 간단 요약
     ① 종합 배너: OVER/DUPLICATE 있으면 ⚠️주의, 없으면 ✅안전
     ② 🤖 종합 문단 (룰 조합)
     ③ 성분별 1줄: {신호} {성분} · 권장 {recommended}{unit} · 지금 {total}{unit}   (전부 나열)
     ④ ▸ 자세히 보기 → 기존 ReportCard 펼침 (상한·근거·LLM설명)
     (위험 시) RecommendedSetCard 노출
     [안전해요 결제] / (위험)[상품 다시 담기]·[그래도 결제]
        ▼
   [done] 결제완료 (데모)
```

## 컴포넌트 / 상태 변경

### `(checker)/page.tsx`
- checkout 뷰에서 **나이 입력 UI 제거** + `ageValid` 결제 게이팅 제거. `결제하기`는 `cart.length>0`이면 항상 활성, 클릭 시 `setNudgeOpen(true)`.
- 페르소나 prefill 나이는 유지하되, 모달에 `initialAgeYears?: number | null`로 전달(없으면 null).
- `NudgeModal`에서 나이를 받기 때문에 `onConfirmPay`는 그대로(→ done), `onAdjust`(→ shop), `onClose`(→ checkout 유지).

### `NudgeModal.tsx` (핵심 변경)
- 내부 상태 `step: 'age' | 'result'`, `ageYears` (모달 소유; `initialAgeYears`로 초기화), `report`/`loading`/`errorMsg`.
- **STEP 1**: number 입력(0~18) + prefill 문구 분기 + `[이 나이로 분석하기]`. 클릭 시 `/analyze` 호출 후 `step='result'`.
- **STEP 2**:
  - `hasRisk = byNutrient.some(verdict ∈ {OVER, DUPLICATE})` (기존 로직 재사용)
  - **종합 문단(파생, deterministic)**: `구매하신 {productIds.length}개 제품을 분석했어요. 만 {ageYears}세 기준 ` +
    - 전부 SAFE → `모든 성분이 적정 범위예요.`
    - 그 외 → 플래그 성분 묶음: OVER `{names} 상한 초과 주의`, DUPLICATE `{names} 겹침`, UNKNOWN `{names} 기준 없음(확인불가)` 를 자연스럽게 연결.
  - **성분 1줄 리스트(전부)**: 신호 아이콘은 `ReportCard`의 `VERDICT_STYLE` 재사용. `recommended === null`이면 "권장 기준 없음".
  - **자세히 보기 토글**: `showDetail` 상태 → `<ReportCard report={report} />` 펼침.
  - **위험 시** `<RecommendedSetCard ageYears report />` 노출.
- 푸터 버튼: 안전 `[안전해요, 결제하기]`→onConfirmPay / 위험 `[상품 다시 담기]`→onAdjust · `[그래도 결제]`→onConfirmPay.
- 종합 문단·1줄 포맷 헬퍼는 `format.ts` 또는 모달 내 로컬 함수로(작으면 로컬).

## 데이터 흐름

기존 `AnalyzeResponse.byNutrient[]`(필드: `ingredientName, totalCanonical, unit, recommended, upperLimit, percentOfRecommended, verdict, explanation, reference`)만으로 ②③④ 전부 구성. **백엔드 변경 없음.** 안전 판정은 전적으로 룰 엔진 결과를 신뢰(표시만 가공).

## 엣지 케이스

- 나이 0~18 검증(모달 STEP1). 범위 밖/빈값이면 분석 버튼 비활성.
- `/analyze` 에러 → STEP2에서 에러 메시지 + 재시도 버튼(나이 유지).
- UNKNOWN 성분 → 종합 문단·1줄에서 "확인불가/권장 기준 없음" 표기(절대 안전으로 둔갑 X).
- cart 빈 경우 → checkout에서 결제 버튼 도달 불가.
- 모달 닫기(X/배경) → checkout 유지(주문 취소 아님).

## 테스트 / 검증

- **백엔드 무변경** → 기존 API 56 테스트 그대로 그린(회귀 0) 확인.
- **Web**: `pnpm --filter @levit/web check:types` + `lint`.
- **수동 e2e** (dev는 IPv6 `localhost` 바인딩 — `localhost`로 접속, `127.0.0.1` 아님):
  shop → 담기 → 결제하기 → STEP1 나이확인 → 분석 → STEP2 간단결과(전 성분 1줄) → 자세히 펼침(ReportCard) → 결제.
  - **안전 케이스** + **위험 케이스(P3 과다 페르소나)** 둘 다, 위험 시 RecommendedSetCard 노출·버튼 분기 확인.

## 비범위 (YAGNI)

- 새 LLM 종합요약 백엔드 필드 — 채택 안 함(룰 조합으로 충분).
- 성분 접기/그룹화 — 채택 안 함(전부 나열).
- i18n 카탈로그화 — MVP는 하드코딩 한국어 유지.
