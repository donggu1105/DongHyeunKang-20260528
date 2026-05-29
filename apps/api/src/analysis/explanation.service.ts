import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { NutrientResult } from './analysis.types';
import { verifyExplanation } from './rules/verify-explanation';

export type ExplainInput = Pick<
  NutrientResult,
  | 'ingredientId'
  | 'verdict'
  | 'totalCanonical'
  | 'unit'
  | 'upperLimit'
  | 'recommended'
  | 'percentOfRecommended'
  | 'reference'
> & { ingredientName: string };

const MODEL = 'gpt-4o-mini';

@Injectable()
export class ExplanationService {
  constructor(private readonly openai: OpenAI) {}

  /**
   * 성분별 설명을 한 번의 LLM 호출로 생성한다.
   * RAG 흐름: KDRIs 근거(검색) → 구조화 facts(증강) → 배치 생성 → 검증.
   * LLM은 부가 설명일 뿐 — 실패하거나 검증을 통과하지 못하면 결정론적 폴백으로 내려간다.
   * 반환: ingredientId → 설명 문자열.
   */
  async explainAll(items: ExplainInput[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();

    // UNKNOWN: 기준 데이터가 없어 LLM을 호출하지 않는다(결정론적 문구).
    const grounded: ExplainInput[] = [];
    for (const it of items) {
      if (it.verdict === 'UNKNOWN') {
        out.set(
          it.ingredientId,
          `${it.ingredientName}: 기준 데이터가 없어 확인 불가합니다. 전문가 상담을 권장합니다.`,
        );
      } else {
        grounded.push(it);
      }
    }
    if (grounded.length === 0) return out;

    try {
      const facts = grounded.map((r) => ({
        ingredientId: r.ingredientId,
        성분: r.ingredientName,
        // 정규화 실패 시 null → "null㎍" 같은 잘못된 문자열을 막기 위해 값이 있을 때만 포함한다.
        ...(r.totalCanonical !== null
          ? { 합산량: `${r.totalCanonical}${r.unit}` }
          : {}),
        권장: r.recommended,
        상한: r.upperLimit,
        권장대비퍼센트: r.percentOfRecommended,
        판정: r.verdict,
        출처: r.reference?.source,
        출처링크: r.reference?.sourceUrl,
      }));

      const res = await this.openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 90 * grounded.length + 60,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'nutrient_explanations',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['explanations'],
              properties: {
                explanations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['ingredientId', 'explanation'],
                    properties: {
                      ingredientId: { type: 'number' },
                      explanation: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        messages: [
          {
            role: 'system',
            content:
              '너는 어린이 영양제 안전 설명가다. 규칙: ' +
              '(1) 아래 제공된 수치와 출처만 사용하고, 제공되지 않은 값·수치는 절대 추측·생성 금지. ' +
              '(2) 판정(판정 필드)과 모순되는 말 금지 — OVER면 "안전"이라 말하지 말 것. ' +
              '(3) 각 성분을 2~3문장 한국어로 쉽게 설명하고 출처를 한 번 언급한다. ' +
              '(4) 입력의 ingredientId를 그대로 매칭해 반환한다.',
          },
          // few-shot: 톤·형식 고정
          {
            role: 'user',
            content: JSON.stringify([
              {
                ingredientId: 0,
                성분: '예시',
                합산량: '41㎍',
                상한: 40,
                권장대비퍼센트: 820,
                판정: 'OVER',
                출처: 'KDRIs 2020',
              },
            ]),
          },
          {
            role: 'assistant',
            content: JSON.stringify({
              explanations: [
                {
                  ingredientId: 0,
                  explanation:
                    '예시 성분의 합산량은 41㎍로 상한 40㎍를 초과합니다. 섭취를 줄이는 것이 좋습니다. (출처: KDRIs 2020)',
                },
              ],
            }),
          },
          { role: 'user', content: JSON.stringify(facts) },
        ],
      });

      const content = res.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(content) as {
        explanations?: { ingredientId: number; explanation: string }[];
      };
      const byId = new Map(
        (parsed.explanations ?? []).map((e) => [e.ingredientId, e.explanation]),
      );

      for (const r of grounded) {
        const cand = byId.get(r.ingredientId);
        const ok =
          typeof cand === 'string' &&
          verifyExplanation(
            {
              verdict: r.verdict,
              totalCanonical: r.totalCanonical,
              upperLimit: r.upperLimit,
              recommended: r.recommended,
              percentOfRecommended: r.percentOfRecommended,
              source: r.reference?.source ?? null,
            },
            cand,
          );
        out.set(r.ingredientId, ok ? cand : this.fallback(r));
      }
    } catch {
      for (const r of grounded) out.set(r.ingredientId, this.fallback(r));
    }

    return out;
  }

  private fallback(r: ExplainInput): string {
    return `${r.ingredientName}: 자동 설명을 생성하지 못했습니다. 위 판정 결과(합산량·상한)를 확인해 주세요.`;
  }
}
