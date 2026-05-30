import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatAgeLabel } from './age-label';

export type IngredientReference = {
  ageMinMonths: number;
  ageMaxMonths: number;
  ageLabel: string;
  recommended: number | null;
  upperLimit: number | null;
  unit: string;
};

export type IngredientInfo = {
  id: number;
  name: string;
  canonicalUnit: string;
  isFatSoluble: boolean;
  references: IngredientReference[];
  source: string;
  sourceUrl: string | null;
};

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<IngredientInfo[]> {
    const rows = await this.prisma.ingredient.findMany({
      include: { references: { orderBy: { ageMinMonths: 'asc' } } },
      orderBy: { id: 'asc' },
    });

    return rows.map((ing) => ({
      id: ing.id,
      name: ing.name,
      canonicalUnit: ing.canonicalUnit,
      isFatSoluble: ing.isFatSoluble,
      // Decimal→number 변환은 서비스 경계에서 끝낸다 — Prisma Decimal을 클라이언트로 누출시키지 않는다.
      references: ing.references.map((r) => ({
        ageMinMonths: r.ageMinMonths,
        ageMaxMonths: r.ageMaxMonths,
        ageLabel: formatAgeLabel(r.ageMinMonths, r.ageMaxMonths),
        recommended: r.recommended === null ? null : Number(r.recommended),
        upperLimit: r.upperLimit === null ? null : Number(r.upperLimit),
        unit: r.unit,
      })),
      source: ing.references[0]?.source ?? 'KDRIs 2020 / 식약처',
      sourceUrl: ing.references[0]?.sourceUrl ?? null,
    }));
  }
}
