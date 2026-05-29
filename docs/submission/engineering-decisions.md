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
