# `/analyze` 설명 파이프라인 v2 — Retrieve → Augment → Generate → Verify

작성일: 2026-05-29 · 대상: `apps/api` (NestJS) · 상태: 구현

## 0. 왜 이 설계인가 (현재 구조의 정당화)

어린이 영양제 안전 도구에서 **안전 판정(SAFE/OVER/DUPLICATE/UNKNOWN)은 결정론적
rule engine**(`rules/aggregate → reference → verdict`)이 계산한다. **LLM은 판정을
내리지 않는다 — 이미 계산된 수치를 사람이 읽기 쉽게 "설명"만** 한다. LLM 호출이
실패해도 판정 결과는 그대로 반환된다(graceful degradation).

> 이유: 건강·안전 도메인에서 LLM이 판정을 환각하면 피해가 크다. 따라서 LLM은
> 신뢰 경계 밖에 두고, 출력은 항상 결정론적 사실로 검증한다.

v2는 이 구조를 유지한 채 **설명 레이어**만 강화한다.

## 1. 파이프라인

```
결정론적 verdict (유지)
  → [Retrieve] 성분별 근거 검색: KDRIs IntakeReference(권장·상한·출처·링크) + 합산량/%
  → [Augment]  구조화된 facts 로 프롬프트 증강 (ingredientId 포함)
  → [Generate] ChatGPT 1콜 배치 · response_format(json_schema) · temperature 0.2 · few-shot
  → [Verify]   판정-모순 / 환각-숫자 검증 → 통과만 채택, 실패 시 결정론적 폴백
```

지식 베이스(retrieval 출처)는 **이미 DB에 있는 KDRIs `IntakeReference`**다. 새로운
의료 사실을 코드가 지어내지 않는다. (스케일 시 벡터/문서 스토어로 확장 — 로드맵.)

## 2. 개선 포인트 (vs 현재)

| 항목 | 현재 | v2 |
|------|------|-----|
| LLM 호출 | 성분당 1콜 (N콜 병렬) | **1콜 배치** (지연·비용↓, 톤 일관성↑) |
| 출력 형식 | 자유 텍스트 | **구조화 JSON** (`{ingredientId, explanation}[]`) |
| 가드레일 | 프롬프트 한 줄 | **결정론적 검증기**(환각 숫자·판정 모순 차단) |
| 파라미터 | 기본값 | `temperature 0.2`, `max_tokens` 캡, few-shot |

> ChatGPT 사용은 과제 필수 제약이므로 LLM을 **줄이지 않고 더 견고하게** 쓰는 방향.
> (UNKNOWN만 기준 데이터가 없어 LLM 미사용 — 결정론적 문구.)

## 3. 검증기 규칙 (`rules/verify-explanation.ts`, 순수 함수)

`verifyExplanation(facts, explanation): boolean` — 통과한 설명만 노출. fail-safe(의심→폴백).

1. **빈 문자열** → reject
2. **환각 숫자 차단**: 설명 내 모든 수치는 `{합산량, 상한, 권장, 권장대비%}` ∪ `출처 문자열의 숫자`(예: "KDRIs 2020"의 2020) 집합에 있어야 함
3. **판정 모순 차단**: `OVER`인데 "안전/문제없" 언급 → reject · `SAFE`인데 "초과/위험/상한 넘" → reject

## 4. 변경 파일

- `analysis/rules/verify-explanation.ts` (신규, 순수 + TDD)
- `analysis/rules/verify-explanation.spec.ts` (신규)
- `analysis/explanation.service.ts` (rewrite: `explain` → `explainAll` 배치+검증)
- `analysis/explanation.service.spec.ts` (rewrite, OpenAI mock)
- `analysis/analysis.service.ts` (N콜 Promise.all → `explainAll` 1콜)
- `analysis/analysis.service.spec.ts` (mock `explain` → `explainAll`)

테스트는 OpenAI를 **mock** → 개발·CI는 OpenAI 크레딧 0원. 실제 호출은 데모 시에만.

## 5. 로드맵 (이번 범위 밖)

- 검증 강화: 결정론적 검증 통과 후 **LLM-judge 2차 패스**(비용↑이므로 옵션)
- 진짜 RAG: KDRIs/연구 문헌 코퍼스 → 임베딩 검색 → 인용 강화
- 제품 라벨 → ChatGPT 구조화 추출 엔드포인트(카탈로그 자동 확장, 크롤러 스텁 연계)
- `Analysis*` 모델에 결과 저장 → 히스토리·캐시·분석
