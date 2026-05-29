# 진행 상황 & 남은 작업 — 우리 아이 영양제 신뢰 체커

> 기준일 2026-05-29. `main`에 머지됨(design/supplement-trust-checker → main, origin 푸시).
> 설계: `2026-05-29-supplement-trust-checker-design.md` · 구현계획: `2026-05-29-supplement-trust-checker-implementation.md`

## 1. 완료 상태 요약

| Phase | 내용 | 상태 | 검증 |
|---|---|---|---|
| A | openai 의존성 + DB 동기화 + 데이터 모델 커밋 | ✅ 완료 | db push 동기화, prisma client 생성 |
| B | 룰 계산 코어(단위정규화·기준선택·합산·판정·오케스트레이터) | ✅ 완료 | **27 단위테스트**, spec+품질 리뷰 통과(거짓경보·부동소수점 수정 반영) |
| C | `POST /analyze` + 입력검증 + 누락ID 안전가드 | ✅ 완료 | **35 unit + 4 e2e**, spec+품질 리뷰 통과 |
| D | 근거기반 LLM 설명 + 환각/장애 가드레일 | ✅ 완료 | spec+품질 리뷰 통과. **키 없어도 fallback로 /analyze 동작** |
| E | KDRIs 기준 + 제품 시드(실DB) + `GET /products` + 크롤러 스텁 | ✅ 완료 | **실 Supabase로 검증**: 성분8·기준42·제품9·제품성분17, KDRIs 값 직접 대조 |
| F | 프론트(API클라이언트·체커페이지·리포트/세트 카드 + **페르소나 랜딩**) | ✅ **완료** | **실DB+API 브라우저 e2e**(랜딩→P3→과다 리포트). tsc 0. spec/품질 리뷰만 잔여 |
| G | 배포 + README 로그 | ⛔ 미착수 | — |
| 최종 | 전체 코드리뷰 + 브랜치 마무리 | ⛔ 미착수 | — |

**전체 API 테스트: 35 unit + 4 e2e = 39 통과, tsc clean.** 모든 백엔드 Phase는 구현자→spec리뷰→품질리뷰→수정 루프를 거침.

## 2. 검증된 핵심 동작 (실DB 기준, 8세=96개월)
- 비타민D 6–8세 권장 5㎍ / **상한(UL) 40㎍** (KDRIs 2020 일치).
- 데모 시나리오: 종합(10㎍)+드롭(10㎍)+고함량(25㎍)=**45㎍ > 40 → 과다(OVER)**; 유산균 → **확인불가(UNKNOWN)**; 나머지 안전.
- **거짓경보 금지**: 권장 500%여도 UL 이내면 OVER 아닌 DUPLICATE.
- **키 없이도 안전**: OpenAI 키 부재 시 설명은 fallback 문자열, 판정은 정상 반환(500 안 남).

## 3. Phase F 검증 완료 (2026-05-29)
- ✅ **빌드/런타임 검증**: 실DB+API로 web 구동, `127.0.0.1:3000/check` 브라우저 e2e — 랜딩→P3 카드→나이·장바구니 프리필→**비타민D 과다 리포트** 전 경로 동작. `pnpm --filter @levit/web check:types` 0 에러.
- ✅ **`/check` 공개 경로 확인**: `proxy.ts`(미들웨어)는 `/dashboard`만 보호 → `/check`는 Clerk 인증 없이 접근. placeholder `CLERK_SECRET_KEY`도 렌더 무관.
- ✅ **페르소나 랜딩 구현**(§4) + 설계문서 §2.0.1 반영. P2·P1 시연 포인트도 API로 검증(거짓경보 금지·확인불가).
- [ ] **남은 것 — 프론트 spec/품질 2단계 리뷰**(백엔드와 달리 미실시).
- ⚠️ **OpenAI 설명**: 키는 있으나 계정 **quota=0(429)** → 설명은 fallback(설계대로 graceful degrade, 판정 정상). 결제 추가 시 코드 수정 없이 자동 복구.
- 참고: `localhost:3000`은 다른 프로젝트 Nuxt가 IPv6 선점 → 검증·데모는 `127.0.0.1:3000` 사용. repo 전체 prettier 1회 돌아 api 소스 일괄 정리됨(로직 불변).

## 4. ✅ 페르소나 선택 진입 (POC 데모 레이어) — 구현 완료 2026-05-29
2026-05-29 브레인스토밍 합의 → **구현·검증 완료**, 설계문서 §2.0.1 반영. 결정·결과:
- **구성**: 페르소나 랜딩 → 맞춤 씬 (랜딩에서 카드 선택 → 나이·장바구니 프리필 → 검사 → 리포트). 기존 체커 컴포넌트 재사용 위에 얹음.
- **범위**: P3중심 + P2·P1 보조 + ✂직접선택. **P4(효능 의심)는 체커 범위 밖이라 제외** (랜딩에 "효능이 아니라 성분 안전을 본다" 한 줄).
- **시나리오 프리셋** (시드 제품 *이름*으로 매핑, 프론트가 `GET /products`에서 id 해석):

| 페르소나 | 나이 | 지금 먹이는 중 | 새 후보 | 시연 포인트 |
|---|---|---|---|---|
| P3 케어맘(주력) | 8세 | 키즈 종합비타민 구미·프로바이오틱스 키즈·비타민D 드롭 | 비타민D3 구미 고함량 | D 45㎍>상한 → 과다 + 유산균 확인불가 + 나머지 안전 (히어로) |
| P2 워킹맘 | 6세 | (없음) | 비타민D3 구미 고함량 단독 | 나이만 → 5초 단독체크, 권장 500%지만 상한 이내=안전(거짓경보 금지) |
| P1 초보맘 | 3세 | 프로바이오틱스 키즈 | 종합비타민 시럽 | 확인불가(정직) + 출처·근거 신뢰장치 |
| ✂ 직접 | — | (빈 체커) | — | 원래 수동 흐름 |

- **추가된 파일**: `components/checker/personaScenarios.ts`(프리셋+힌트), `components/checker/PersonaLanding.tsx`(카드 그리드), `check/page.tsx`(진입상태 `landing`↔`checker` + 이름→id 프리필 + 맥락 배너 + 복귀), `AgeStep.tsx`(`initialYears` 프리필 prop).
- **UI**: ui-ux-pro-max "Accessible & Ethical"(고대비·focus-visible 링·44px+ 터치·semantic), 기존 blue/gray 팔레트 유지, 기능 아이콘 SVG/페르소나 표식만 장식 이모지(aria-hidden). 직접선택 이모지는 ✂→✏️.

## 5. 남은 작업 (TODO)
1. ✅ ~~페르소나 랜딩 구현 + 설계문서 반영~~ (완료 2026-05-29, §3·§4).
2. **Phase F spec/품질 2단계 리뷰** (런타임 e2e 검증은 완료 — §3). 백엔드처럼 구현자→spec→품질 루프 적용.
3. **OpenAI 키**: 키 적재 완료. 단 계정 **quota=0**이라 설명은 fallback — 결제/크레딧 추가하면 실제 생성 검증 가능(코드 무변경).
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
make dev-web        # web :3000 — 데모는 http://127.0.0.1:3000/check (localhost는 다른 Nuxt가 IPv6 선점)
```
환경변수/.mcp 복사값은 세션 로그 및 `apps/api/.env.example` 참고. 비밀값은 기존 `.env`/`.envrc`에서 복사.
