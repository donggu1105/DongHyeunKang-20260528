import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyzeRequestDto } from './dto/analyze.dto';
import { runAnalysis } from './rules/analyze';
import type { IngredientDef, ProductInput, ReferenceDef, NutrientResult } from './analysis.types';

const DISCLAIMER = '본 결과는 참고용이며 약사·소아과 상담을 권장합니다.';
const num = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));

@Injectable()
export class AnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(dto: AnalyzeRequestDto): Promise<{ byNutrient: NutrientResult[]; disclaimer: string }> {
    const ingRows = await this.prisma.ingredient.findMany();
    const ingredients: IngredientDef[] = ingRows.map((i) => ({ id: i.id, name: i.name, canonicalUnit: i.canonicalUnit, isFatSoluble: i.isFatSoluble }));

    const refRows = await this.prisma.intakeReference.findMany();
    const references: ReferenceDef[] = refRows.map((r) => ({
      ingredientId: r.ingredientId, ageMinMonths: r.ageMinMonths, ageMaxMonths: r.ageMaxMonths,
      sex: r.sex as ReferenceDef['sex'], recommended: num(r.recommended), upperLimit: num(r.upperLimit),
      unit: r.unit, source: r.source, sourceUrl: r.sourceUrl ?? null,
    }));

    const prodRows = await this.prisma.product.findMany({
      where: { id: { in: dto.productIds } },
      include: { ingredients: true },
    });
    const products: ProductInput[] = prodRows.map((p) => ({
      productId: p.id, name: p.name,
      amounts: p.ingredients.map((pi) => ({ ingredientId: pi.ingredientId, amount: Number(pi.amount), unit: pi.unit })),
    }));

    const byNutrient = runAnalysis({ ageMonths: dto.ageMonths, sex: dto.sex ?? null, products, ingredients, references });
    return { byNutrient, disclaimer: DISCLAIMER };
  }
}
