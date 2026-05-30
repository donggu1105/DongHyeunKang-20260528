# 성분 돋보기(NutrientInfo) 팝오버 — 설계

> 2026-05-30 · 상태: 승인됨(브레인스토밍 완료) → 다음 단계: writing-plans

## 목표

ProductCard·ReportCard에 뜨는 영양소 이름(칼슘·비타민D·아연 …)에 **돋보기(🔍)** 를 달아,
호버/탭하면 **"우리 아이 기준 적정량 + 단위 정리"** 를 간단·가독성 있게 보여준다.
페르소나(P3 잔병치레 케어맘)가 가장 혼란스러워하는 "이 성분이 우리 아이 나이엔 얼마가 적당한가 /
라벨의 IU는 대체 몇 ㎍인가"를 근거(KDRIs) 기반으로 즉시 해소한다.

## 확정된 결정 (브레인스토밍)

| 항목 | 결정 |
|---|---|
| 콘텐츠 초점 | **우리 아이 적정량 + 단위 정리**(IU↔㎍). 결핍/증상·식품출처는 범위 밖 |
| 나이 처리 | **전 연령표 + 아는 나이 구간 강조**. 나이 모르면 강조만 빠짐 |
| 적용 위치 | **ProductCard + ReportCard 둘 다** (한 컴포넌트 재사용) |
| 데이터 출처 | **접근 A — API가 기준표 서빙**(`IntakeReference` 진실원천). 정적 하드코딩(B) 반려 |
| 표시 원칙 | **되게 간단하고 가독성** — 빽빽한 표 금지, 아이 구간 1줄만 강조 |

핵심 제약(프로젝트 #1 규칙): **LLM은 사실을 만들지 않는다.** 적정량·상한·단위는 전부
DB(KDRIs)·정적 환산표에서 나오고, LLM은 일절 개입하지 않는다.

## 섹션 1 — API: `GET /ingredients`

`products.controller.ts` 패턴을 미러링한 신규 `IngredientsModule`.

```http
GET /ingredients  →  IngredientInfo[]
```

```ts
type IngredientInfo = {
  id: number;
  name: string;            // "비타민D"
  canonicalUnit: string;   // "㎍"
  isFatSoluble: boolean;
  references: {            // IntakeReference 전 연령대 (나이 오름차순)
    ageMinMonths: number;  // 12
    ageMaxMonths: number;  // 35
    ageLabel: string;      // "만 1–2세"  ← 서버에서 개월→읽기 라벨 변환
    recommended: number | null;  // 권장(RDA/AI)
    upperLimit: number | null;   // 상한(UL)
    unit: string;          // "㎍"
  }[];
  source: string;          // "KDRIs 2020 / 식약처"
  sourceUrl: string | null;
};
```

- 데이터: `prisma.ingredient.findMany({ include: { references } })` — 룰 엔진과 **동일한
  `IntakeReference` 진실원천**. 재시드/기준 변경 시 자동 반영.
- `ageLabel` 변환(개월↔"만 N–M세")은 **서버**에서 처리해 클라가 포맷 로직을 안 갖게.
- `references: []`(기준 없는 성분, 예: 유산균)은 빈 배열 → 팝오버가 "확인불가"로 분기.
- `source`/`sourceUrl`은 references 중 대표값(전 구간 동일 출처) 사용.

## 섹션 2 — 팝오버 콘텐츠 (간단·가독)

만 6세 아이가 비타민D에 호버한 경우:

```
┌─────────────────────────────────────┐
│ 비타민D   뼈·면역                 🔍 │   이름 + 한 줄 역할(짧은 정적 카피)
│ ─────────────────────────────────── │
│ 💊 1000IU = 25㎍   (라벨 IU 환산)     │   단위 정리(IU 라벨 흔한 성분만)
│ ─────────────────────────────────── │
│   나이        권장      상한          │
│   만 3–5세     5㎍      35㎍          │
│ ▸ 만 6–8세     5㎍      40㎍   우리아이 │   아이 구간 1줄만 굵게 + ▸
│   만 9–11세    5㎍      60㎍          │
│   …                                 │
│ ─────────────────────────────────── │
│ 기준: KDRIs 2020 · 식약처      [출처] │   근거(신뢰)
└─────────────────────────────────────┘
```

가독성 원칙:
- 표는 **3열(나이·권장·상한)**, 아이 구간 1줄만 강조(`▸`+굵게), 나머지는 옅은 회색.
- **단위 줄은 지방용성(비타민D·A·E)에만** 노출. 칼슘·아연 등은 줄 자체를 숨김.
- 역할 한 줄(`뼈·면역`)은 **8개 캐논 성분 짧은 정적 카피**(LLM 아님). 표/숫자는 전부 API.

### 단위 환산표 (정적 데이터, 지방용성 3종)

| 성분 | 환산 | 예시 |
|---|---|---|
| 비타민D | 1㎍ = 40 IU | 1000IU = 25㎍ |
| 비타민A | 1㎍RAE ≈ 3.33 IU | — |
| 비타민E | 1mg ≈ 1.49 IU | — |

- 기준 없는 성분(유산균): 표 대신 **"공식 기준이 없어 확인불가"** 한 줄 (체커 UNKNOWN과 동일 정직성).

## 섹션 3 — `<NutrientInfo>` 컴포넌트 + 인터랙션

신규 `apps/web/src/components/checker/NutrientInfo.tsx`.

```tsx
<NutrientInfo ingredientName="비타민D" ageMonths={72}>비타민D</NutrientInfo>
```

- 데이터: `useIngredients()` 훅이 `GET /ingredients`를 **앱 1회 fetch → 모듈 레벨 캐시**(공유,
  호버마다 호출 X). 이름으로 룩업. 환산표는 정적 상수.
- 인터랙션:
  - 데스크톱: **호버 + 키보드 포커스**로 열림.
  - 모바일: hover 부재 → **탭 토글**.
  - 닫힘: mouseleave / blur / **Esc** / 바깥 클릭.
  - 트리거: 이름 옆 작은 **🔍** 표식.
- 접근성: `aria-expanded`, 팝오버 `role="tooltip"`, Esc 닫힘, 포커스 동작.
- 배선:
  - ReportCard: `ageMonths` 전달 → 아이 구간 강조.
  - ProductCard: `ageMonths` 없음(둘러보기) → 강조 없이 전 연령표.

### ⚠️ 기술 제약 — 중첩 버튼 회피

ProductCard는 카드 전체가 `<button>`(담기)다. 그 안에 또 `<button>`을 넣으면 HTML 중첩 버튼·
a11y 위반. → NutrientInfo 트리거는 **버튼이 아닌 포커스 가능한 `span`**(`role`/`tabIndex` +
키 핸들러)으로 만들고, 클릭에 **`stopPropagation`** 해서 "담기" 토글이 발화하지 않게 한다.

## 섹션 4 — 에러 처리 + 테스트

그레이스풀 디그레이드(프로젝트 철학 유지):
- `/ingredients` fetch 실패 → 팝오버는 역할 한 줄 + "기준 정보를 불러오지 못했어요". **페이지 무중단.**
- 캐논 외 성분(데이터에 없음) → 🔍 표식 미렌더(그냥 텍스트). 깨진 팝오버 없음.
- 기준 없는 성분(유산균) → 표 대신 "확인불가" 한 줄.

테스트:
- API: `ingredients.service.spec.ts` — 전 캐논 성분·references 나이 오름차순·`ageLabel` 변환,
  references 빈 성분은 빈 배열 (Jest, `products.service.spec.ts` 미러링).
- 단위 환산 순수함수 테스트(㎍↔IU, D/A/E).
- 웹: NutrientInfo — 호버/포커스로 열림, `ageMonths` 주면 해당 구간 강조, 기준 없는 성분 분기,
  **stopPropagation으로 담기 토글 안 됨** (vitest + testing-library).

## 범위 밖 (YAGNI)

- 결핍/과다 증상, 식품 출처, 복용 타이밍 등 일반 영양 백과 콘텐츠.
- 성분별 LLM 생성 설명(트러스트 철학상 적정량/단위는 결정론 데이터만).
- 성분 간 상호작용(예: 칼슘+철 흡수 경쟁) — 별도 기능.

## 영향 받는 파일(예상)

- 신규: `apps/api/src/ingredients/{ingredients.module,controller,service,service.spec}.ts`
- 신규: `apps/web/src/components/checker/NutrientInfo.tsx`, `useIngredients` 훅, 정적 환산표/역할카피
- 수정: `apps/web/src/libs/Api.ts`(타입+`getIngredients`), `ProductCard.tsx`·`ReportCard.tsx`(배선)
- 수정: `apps/api/src/app.module.ts`(모듈 등록)
