import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { NutrientResult } from './analysis.types';

export type ExplainInput = Pick<NutrientResult, 'verdict' | 'totalCanonical' | 'unit' | 'upperLimit' | 'percentOfRecommended' | 'reference'> & { ingredientName: string };

@Injectable()
export class ExplanationService {
  constructor(private readonly openai: OpenAI) {}

  async explain(r: ExplainInput): Promise<string> {
    if (r.verdict === 'UNKNOWN') {
      return `${r.ingredientName}: 기준 데이터가 없어 확인 불가합니다. 전문가 상담을 권장합니다.`;
    }
    // LLM은 부가 설명일 뿐 — 실패해도 결정론적 안전 판정을 막지 않는다.
    try {
      const facts = {
        성분: r.ingredientName,
        // 합산량은 정규화 실패 시 null이 될 수 있으므로 "null㎍" 같은 잘못된 문자열을 막기 위해 값이 있을 때만 포함한다.
        ...(r.totalCanonical !== null ? { 합산량: `${r.totalCanonical}${r.unit}` } : {}),
        상한: r.upperLimit,
        권장대비퍼센트: r.percentOfRecommended, 판정: r.verdict,
        출처: r.reference?.source, 출처링크: r.reference?.sourceUrl,
      };
      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '너는 어린이 영양제 안전 설명가다. 아래 제공된 수치와 출처만 사용하고, 제공되지 않은 값은 추측 금지. 2~3문장 한국어로 쉽게 설명하고 출처를 언급한다.' },
          { role: 'user', content: JSON.stringify(facts) },
        ],
      });
      return res.choices[0]?.message?.content ?? this.fallback(r);
    } catch {
      return this.fallback(r);
    }
  }

  private fallback(r: ExplainInput): string {
    return `${r.ingredientName}: 자동 설명을 생성하지 못했습니다. 위 판정 결과(합산량·상한)를 확인해 주세요.`;
  }
}
