import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExplanationService } from './explanation.service';
import { AnalyzeRequestDto } from './dto/analyze.dto';
import { runAnalysis } from './rules/analyze';
import type {
  IngredientDef,
  ProductInput,
  ReferenceDef,
  NutrientResult,
} from './analysis.types';

type ExplainedNutrient = NutrientResult & {
  ingredientName: string;
  explanation: string;
};

const DISCLAIMER = '본 결과는 참고용이며 약사·소아과 상담을 권장합니다.';
const num = (d: unknown): number | null => {
  if (d === null || d === undefined) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
};

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly explanation: ExplanationService,
  ) {}

  async analyze(
    dto: AnalyzeRequestDto,
  ): Promise<{ byNutrient: ExplainedNutrient[]; disclaimer: string }> {
    // 의도적 load-all: MVP 규모(성분 ~5-8개)라 전량 로드가 단순하고 충분함.
    const ingRows = await this.prisma.ingredient.findMany();
    const ingredients: IngredientDef[] = ingRows.map((i) => ({
      id: i.id,
      name: i.name,
      canonicalUnit: i.canonicalUnit,
      isFatSoluble: i.isFatSoluble,
    }));

    // 의도적 load-all: MVP 규모(성분 ~5-8개)라 전량 로드가 단순하고 충분함.
    const refRows = await this.prisma.intakeReference.findMany();
    const references: ReferenceDef[] = refRows.map((r) => ({
      ingredientId: r.ingredientId,
      ageMinMonths: r.ageMinMonths,
      ageMaxMonths: r.ageMaxMonths,
      sex: r.sex,
      recommended: num(r.recommended),
      upperLimit: num(r.upperLimit),
      unit: r.unit,
      source: r.source,
      sourceUrl: r.sourceUrl ?? null,
    }));

    // 안전 도구: 선택한 제품 중 하나라도 없으면 부분 분석(OVER→SAFE 오판 위험)을 막기 위해 명시적으로 실패시킨다.
    const requestedIds = [...new Set(dto.productIds)];
    const prodRows = await this.prisma.product.findMany({
      where: { id: { in: requestedIds } },
      include: { ingredients: true },
    });
    if (prodRows.length !== requestedIds.length) {
      const found = new Set(prodRows.map((p) => p.id));
      const missing = requestedIds.filter((id) => !found.has(id));
      throw new BadRequestException(
        `존재하지 않는 제품 ID: ${missing.join(', ')}`,
      );
    }
    const products: ProductInput[] = prodRows.map((p) => ({
      productId: p.id,
      name: p.name,
      amounts: p.ingredients.map((pi) => ({
        ingredientId: pi.ingredientId,
        amount: Number(pi.amount),
        unit: pi.unit,
      })),
    }));

    const byNutrient = runAnalysis({
      ageMonths: dto.ageMonths,
      sex: dto.sex ?? null,
      products,
      ingredients,
      references,
    });

    const nameById = new Map(ingredients.map((i) => [i.id, i.name]));
    // 방어 코드: ingredients와 results는 동일 로드에서 파생되므로 fallback은 실제로 발동하지 않아야 한다.
    const named = byNutrient.map((r) => ({
      ...r,
      ingredientName: nameById.get(r.ingredientId) ?? String(r.ingredientId),
    }));

    // 설명(LLM)은 부가 정보 — 한 번의 배치 호출로 생성하고, 실패해도 결정론적 안전 판정을 막지 않는다.
    const explanations = await this.explanation
      .explainAll(named)
      .catch(() => new Map<number, string>());

    const explained: ExplainedNutrient[] = named.map((r) => ({
      ...r,
      explanation: explanations.get(r.ingredientId) ?? '설명을 불러오지 못했습니다.',
    }));

    return { byNutrient: explained, disclaimer: DISCLAIMER };
  }
}
