import type { VerdictCode } from '../analysis.types';

export type VerifyInput = {
  verdict: VerdictCode;
  totalCanonical: number | null;
  upperLimit: number | null;
  recommended: number | null;
  percentOfRecommended: number | null;
  source: string | null;
};

/**
 * LLM이 생성한 설명이 결정론적 판정·근거와 모순되지 않는지 검증한다.
 * 어린이 건강 도구이므로 의심스러우면 false를 반환해 호출부가 안전한 폴백으로
 * 내려가게 한다(fail-safe). 통과한 설명만 사용자에게 노출된다.
 */
export function verifyExplanation(
  facts: VerifyInput,
  explanation: string,
): boolean {
  const text = explanation.trim();
  if (text.length === 0) return false;

  // 1) 환각 숫자 차단 — 설명에 등장하는 모든 수치는 제공된 근거(또는 출처 표기)에 있어야 한다.
  const allowed = new Set<string>();
  for (const n of [
    facts.totalCanonical,
    facts.upperLimit,
    facts.recommended,
    facts.percentOfRecommended,
  ]) {
    if (n !== null) allowed.add(String(n));
  }
  // 출처 표기에 들어간 숫자(예: "KDRIs 2020"의 2020)는 환각이 아니므로 허용한다.
  for (const n of facts.source?.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(n);

  for (const n of text.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (!allowed.has(n)) return false;
  }

  // 2) 판정 모순 차단
  if (facts.verdict === 'OVER' && /안전|문제\s*없|걱정\s*없/.test(text)) {
    return false;
  }
  if (facts.verdict === 'SAFE' && /(초과|위험|상한을?\s*넘)/.test(text)) {
    return false;
  }

  return true;
}
