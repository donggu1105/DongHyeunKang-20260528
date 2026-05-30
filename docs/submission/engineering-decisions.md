# 엔지니어링 결정 로그

> 과제를 풀며 **무엇을 고민했고 어떻게 해결했는지**를 작업마다 아주 간략히 남기는 러닝 로그.
> 형식: `요구사항`(맥락이 요구한 것) · `고민`(저울질·트레이드오프) · `해결`(어떻게 풀었나·결과).

---

## 01. `/analyze` 설명 파이프라인 — LLM 신뢰 경계 (2026-05-29)

- **요구사항**: ChatGPT 활용(필수 제약) + 어린이 건강 안전 영역의 신뢰 가능한 결과.
- **고민**: ① LLM이 안전 "판정"을 환각하면 피해가 큼 ② 성분당 LLM 1콜(N콜)은 비효율 ③ 설명 품질·톤 일관성·근거 없는 수치 노출 위험.
- **해결**: 판정은 **결정론적 rule engine**이 계산하고 **LLM은 "설명"만**(신뢰 경계 밖, 실패해도 판정 생존). 설명 레이어 v2 = **1콜 배치** + 구조화 JSON(`response_format`) + **검증기**(환각 숫자·판정 모순 차단, fail-safe→폴백). 테스트는 OpenAI mock(크레딧 0원). 41개 테스트·빌드 통과.

## 02. 루트(`/`)를 체커 메인 페이지로 (2026-05-29)

- **요구사항**: `make dev` 후 `127.0.0.1:3000` 진입 시 ixartz 보일러플레이트 인덱스 대신 **제품(영양제 안전 체커)이 바로** 보이게.
- **고민**: ① 리다이렉트(`/`→`/check`)는 URL이 `/check`로 바뀜 ② `(marketing)` 그룹에 체커를 넣으면 ixartz 네비바/배너 chrome가 따라붙음 ③ docs·페르소나가 참조하는 `/check` 링크를 깨뜨리면 안 됨.
- **해결**: 체커 컴포넌트를 `(checker)/page.tsx`로 옮겨 **URL `/` 그대로 서빙**(chrome 없는 `[locale]/layout.tsx`만 사용). `/check`는 `export { default } from '../page'` **alias로 유지**. `/` 라우트 충돌 막으려 `(marketing)/page.tsx` 제거. `(checker)/layout.tsx`로 탭 제목 부여. `/`·`/check` 둘 다 200·체커 렌더 확인.

## 03. 프로덕션 배포 + `make deploy` (2026-05-30)

- **요구사항**: 위 변경을 실제 배포하고 동작 검증 후, 반복 가능한 `make deploy` 한 줄로 만들기.
- **고민**: 두 플랫폼의 배포 방식이 달랐음 — Vercel(web)은 push에 자동배포가 **안 걸려** 있었고(실측: main 푸시해도 신규 배포 미발생), Railway(api)는 GitHub 연동 자동배포(로컬에 railway CLI/토큰 없음 → 유일 경로). 둘을 한 타겟에 어떻게 정직하게 묶을지.
- **해결**: `make deploy` = `deploy-api`(`git push origin main` → Railway 자동빌드) + `deploy-web`(`cd apps/web && vercel --prod`). 실제 메커니즘대로 분리. 검증: web `/`·`/check` 200·체커, API `/products`(30개)·`/analyze`(201, KDRIs 판정/설명) 정상, CORS prod origin 허용. Live: web `levit-trust-web.vercel.app`, api `api-production-ca14e.up.railway.app`.
  - ⚠️ **정정(#04 참고)**: 위 "Railway=git push 자동배포" 가정은 **틀렸음.** API는 `railway up`(CLI)로 배포됨.

## 04. `make deploy-api` 정정 — Railway는 git push가 아니라 `railway up` (2026-05-30)

- **요구사항**: railway CLI 설치·로그인 후, API 배포 메커니즘을 실제로 확인하고 `make deploy-api`를 맞게 고치기.
- **고민**: #03에서 "로컬에 railway CLI가 없으니 Railway는 GitHub 연동 자동배포일 것"이라 **추정**했는데, 근거가 약했음(오늘 푸시로 API 새 배포가 안 생긴 걸 "apps/api 미변경이라 그렇겠지"로 넘길 수도 있었음).
- **해결**: railway CLI 설치(`brew install railway`)·로그인·`railway link`(project `levit-trust-api`, service `api`, env `production`) 후 `railway status --json` 확인 → 활성 배포 메타에 `cliMessage: "fix start path..."`(커밋 아님) + `fileServiceManifest`(업로드 매니페스트) → **`railway up` CLI 업로드 배포로 확정**. git 연동 아님. `make deploy-api`를 `railway up --service api`로 교체. README·#03도 정정. 교훈: "CLI 없음 → 자동배포" 추론은 비약, 배포 메타로 검증해야 함.

## 05. 커머스형 화면 재구성 + 결제 직전 넛지 모달 (2026-05-30)

- **요구사항**: 체커를 실제 커머스(vitaminshop 상품 진열)처럼 — 상품을 이미지·가격과 함께 고르고, 결제 직전 "내 아이한테 지금 맞을까요?" 모달이 **무조건** 떠서 중복·과다를 넛지하는 플로우.
- **고민**: ① 이미지/가격 데이터가 전부 NULL(타사 자산 사용의 정직성) ② 안전 판정 룰 엔진을 절대 오염시키지 않으면서 가격·이미지를 표시 전용으로 격리 ③ 처음엔 "상황→제품→나이→결과" 스텝퍼로 만들었더니 과제스러워 커머스답지 않았음(사용자 피드백) ④ id 기반 LCG 첫 출력이 seed와 상관도가 높아 전 제품이 같은 이미지로 쏠림(58개 중 distinct 2).
- **해결**: `Product.listPrice`(정상가) 추가 + `/products`에 imageUrl·price·listPrice 노출(룰 엔진 무변경, 표시 전용). vitaminshop 상품 이미지 30종을 `apps/web/public/products/`로 다운로드(런타임 핫링크 X, 데모 더미 명시) 후 **id 곱셈 해시로 분산 매핑**(LCG 첫 출력 쏠림 회피 → distinct 30). 스텝퍼 폐기 → **목록(전체폭 5열)→장바구니/결제(합계·나이)→결제하기 시 무조건 넛지 모달(분석+검증된 세트 교체 유도)→결제완료(데모)**. `/check`→`/` 리다이렉트로 단일 진입. 검증: API 56 테스트 그린(회귀 0), 전 플로우 시각 확인. 메모: dev 서버가 **IPv6(`localhost`)** 로 바인딩 → `127.0.0.1`로는 클라 런타임/HMR이 깨져 인터랙션 불가, `localhost`로 접속해야 함(CLAUDE.md gotcha 역방향 — 갱신 필요).

## 06. 성분 돋보기(NutrientInfo) — 나이별 적정량·단위 팝오버 (2026-05-30)

- **요구사항**: 성분 이름(칼슘·비타민D·아연…)에 hover/탭하면 돋보기 팝오버로 "우리 아이 나이별 권장·상한 + 단위(IU↔㎍) 정리"를 보여줘 페르소나가 혼란스러워하는 부분(적정량·단위)을 즉시 해소.
- **고민**: ① 교육 콘텐츠를 LLM으로 생성하면 환각 위험 + 트러스트 철학("LLM은 사실 안 만짐") 위반 → 결정론 데이터로만. ② "전 연령표"를 어디서? 정적 하드코딩은 재시드 시 드리프트 → 진실원천 이중화. ③ ProductCard는 카드 전체가 `<button>`이라 트리거를 또 버튼으로 두면 중첩 버튼(a11y 위반). ④ 팝오버 onBlur가 내부 `출처` 링크 도달 전에 닫혀 키보드/클릭 접근 불가.
- **해결**: 신규 `GET /ingredients`가 `IntakeReference` 전 연령 기준표를 서빙(룰 엔진과 동일 진실원천, 재시드 자동 반영). 단위 환산(D/A/E)·역할 카피만 정적. `useIngredients` 모듈캐시 훅(앱 1회 fetch). `<NutrientInfo>` 팝오버는 `<span role="button">`+`stopPropagation`으로 중첩버튼 회피, 호버/탭/Esc, 아이 나이 구간 `▸` 강조, 기준 없는 성분(유산균)은 "확인불가" 분기, fetch 실패·캐논 외 성분은 그레이스풀(돋보기 미렌더). onBlur는 outer 래퍼 focus-within(`contains(relatedTarget)`)으로 고쳐 출처 링크 접근 보장. ProductCard(강조X)·ReportCard(나이 강조, NudgeModal에서 ageMonths 주입) 배선. **TDD subagent-driven(태스크별 spec+quality 2단계 리뷰)**: API 60/60, 웹 9/9(NutrientInfo 브라우저 컴포넌트 테스트 포함), 신규 타입에러 0, lint 그린. `/ingredients` 라이브 검증(8성분, 비타민D 6밴드, 유산균 0).
