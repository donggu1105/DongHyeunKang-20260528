# 진행 상황 & 남은 작업 — 우리 아이 영양제 신뢰 체커

> 기준일 2026-05-29. 브랜치 `design/supplement-trust-checker` (origin에 푸시됨).
> 설계: `2026-05-29-supplement-trust-checker-design.md` · 구현계획: `2026-05-29-supplement-trust-checker-implementation.md`

## 1. 완료 상태 요약

| Phase | 내용 | 상태 | 검증 |
|---|---|---|---|
| A | openai 의존성 + DB 동기화 + 데이터 모델 커밋 | ✅ 완료 | db push 동기화, prisma client 생성 |
| B | 룰 계산 코어(단위정규화·기준선택·합산·판정·오케스트레이터) | ✅ 완료 | **27 단위테스트**, spec+품질 리뷰 통과(거짓경보·부동소수점 수정 반영) |
| C | `POST /analyze` + 입력검증 + 누락ID 안전가드 | ✅ 완료 | **35 unit + 4 e2e**, spec+품질 리뷰 통과 |
| D | 근거기반 LLM 설명 + 환각/장애 가드레일 | ✅ 완료 | spec+품질 리뷰 통과. **키 없어도 fallback로 /analyze 동작** |
| E | KDRIs 기준 + 제품 시드(실DB) + `GET /products` + 크롤러 스텁 | ✅ 완료 | **실 Supabase로 검증**: 성분8·기준42·제품9·제품성분17, KDRIs 값 직접 대조 |
| F | 프론트(API클라이언트·체커페이지·리포트/세트 카드) | ⚠️ **부분** | 구현·커밋됨(아래 §3 주의) |
| G | 배포 + README 로그 | ⛔ 미착수 | — |
| 최종 | 전체 코드리뷰 + 브랜치 마무리 | ⛔ 미착수 | — |

**전체 API 테스트: 35 unit + 4 e2e = 39 통과, tsc clean.** 모든 백엔드 Phase는 구현자→spec리뷰→품질리뷰→수정 루프를 거침.

## 2. 검증된 핵심 동작 (실DB 기준, 8세=96개월)
- 비타민D 6–8세 권장 5㎍ / **상한(UL) 40㎍** (KDRIs 2020 일치).
- 데모 시나리오: 종합(10㎍)+드롭(10㎍)+고함량(25㎍)=**45㎍ > 40 → 과다(OVER)**; 유산균 → **확인불가(UNKNOWN)**; 나머지 안전.
- **거짓경보 금지**: 권장 500%여도 UL 이내면 OVER 아닌 DUPLICATE.
- **키 없이도 안전**: OpenAI 키 부재 시 설명은 fallback 문자열, 판정은 정상 반환(500 안 남).

## 3. ⚠️ Phase F 주의 (완전 "완료" 아님)
구현 파일은 커밋돼 존재함:
- `apps/web/src/libs/Api.ts` (getProducts/analyze), `Env.ts`(NEXT_PUBLIC_API_URL), `.env`
- `apps/web/src/app/[locale]/(checker)/check/page.tsx` (장바구니 트리거 + 점진적 공개)
- `apps/web/src/components/checker/{ProductPicker,AgeStep,ReportCard,RecommendedSetCard}.tsx`

**하지만 다음이 미완:**
- [ ] **spec/품질 리뷰 안 됨** (백엔드와 달리 2단계 리뷰 미실시).
- [ ] **빌드/런타임 검증 안 됨** — ixartz 보일러플레이트(Clerk/i18n) 위에서 `/check`가 실제로 컴파일·렌더되는지, 미들웨어가 공개 접근 허용하는지 미확인.
- [ ] **페르소나 랜딩 미반영** (아래 §4 — 설계만 합의, 구현 전).
- [ ] repo 전체 prettier 포맷이 한 번 돌아 api 소스가 일괄 정리됨(로직 불변, 커밋 `style(api): ...`).

## 4. 설계됐으나 미구현 — 페르소나 선택 진입 (POC 데모 레이어)
2026-05-29 브레인스토밍에서 **합의**했으나 아직 구현/설계문서 미반영. 결정 사항:
- **구성**: 페르소나 랜딩 → 맞춤 씬 (랜딩에서 카드 선택 → 나이·장바구니 프리필 → 검사 → 리포트). 기존 체커 컴포넌트 재사용 위에 얹음.
- **범위**: P3중심 + P2·P1 보조 + ✂직접선택. **P4(효능 의심)는 체커 범위 밖이라 제외** (랜딩에 "효능이 아니라 성분 안전을 본다" 한 줄).
- **시나리오 프리셋** (시드 제품 *이름*으로 매핑, 프론트가 `GET /products`에서 id 해석):

| 페르소나 | 나이 | 지금 먹이는 중 | 새 후보 | 시연 포인트 |
|---|---|---|---|---|
| P3 케어맘(주력) | 8세 | 키즈 종합비타민 구미·프로바이오틱스 키즈·비타민D 드롭 | 비타민D3 구미 고함량 | D 45㎍>상한 → 과다 + 유산균 확인불가 + 나머지 안전 (히어로) |
| P2 워킹맘 | 6세 | (없음) | 비타민D3 구미 고함량 단독 | 나이만 → 5초 단독체크, 권장 500%지만 상한 이내=안전(거짓경보 금지) |
| P1 초보맘 | 3세 | 프로바이오틱스 키즈 | 종합비타민 시럽 | 확인불가(정직) + 출처·근거 신뢰장치 |
| ✂ 직접 | — | (빈 체커) | — | 원래 수동 흐름 |

- **구현 시 추가 파일(예정)**: `components/checker/PersonaLanding.tsx`, `components/checker/personaScenarios.ts`, check 페이지에 진입상태(`landing`↔`checker`).

## 5. 남은 작업 (TODO)
1. **페르소나 랜딩 구현** (§4) + 설계문서에 반영.
2. **Phase F 리뷰·검증**: 2단계 리뷰, `pnpm --filter @levit/web build` 또는 dev 구동으로 `/check` 렌더 확인, web+api 동시 구동 스모크 테스트(미들웨어 공개경로 처리 포함).
3. **OpenAI 키**: `apps/api/.env`에 `OPENAI_API_KEY` 추가 시 실제 설명 생성 검증(현재는 fallback).
4. **Phase G 배포**: web→Vercel(Root `apps/web`, `NEXT_PUBLIC_API_URL`=배포 API), api→Railway(Root `apps/api`, build `pnpm build`, start `node dist/main`, env DATABASE_URL/DIRECT_URL/OPENAI_API_KEY), DB→Supabase(시드 1회).
5. **README "막힌 점 → 해결" 로그**: 크롤링 차단(쿠팡/네이버 이미지·안티봇)→iHerb HTML+캐시 / LLM 환각→계산 코드 분리+grounding / 단위 불일치→정규화 테이블 / 거짓경보→OVER는 UL 초과만 / LLM 장애→설명 degrade.
6. **최종 코드리뷰** + 브랜치 마무리(PR: https://github.com/donggu1105/DongHyeunKang-20260528/pull/new/design/supplement-trust-checker).
7. **제출 직전**: collaborator `recruit@ilevit.com` 초대(초대 시점 평가).
8. **(옵션)** pgvector RAG(Phase H) — 현재 grounding은 구조화 lookup으로 충분.

## 6. 로컬 실행 메모
```bash
make dev-api        # api :3001 (DB 필요)
pnpm --filter @levit/api db:seed     # 시드(이미 실DB에 적재됨)
pnpm --filter @levit/api test        # 35 unit
pnpm --filter @levit/api test:e2e    # 4 e2e
make dev-web        # web :3000 (현재 /check 런타임 미검증)
```
환경변수/.mcp 복사값은 세션 로그 및 `apps/api/.env.example` 참고. 비밀값은 기존 `.env`/`.envrc`에서 복사.
