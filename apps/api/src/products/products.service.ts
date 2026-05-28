import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CatalogProduct = {
  id: number;
  name: string;
  brand: string | null;
  form: string | null;
  targetAgeLabel: string | null;
  sourceUrl: string | null;
  ingredients: { name: string; amount: number; unit: string }[];
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CatalogProduct[]> {
    const rows = await this.prisma.product.findMany({
      include: { ingredients: { include: { ingredient: true } } },
      orderBy: { id: 'asc' },
    });

    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand ?? null,
      form: p.form ?? null,
      targetAgeLabel: p.targetAgeLabel ?? null,
      sourceUrl: p.sourceUrl ?? null,
      // Decimal→number 변환은 서비스 경계에서 끝낸다 — Prisma Decimal을 클라이언트로 누출시키지 않는다.
      ingredients: p.ingredients.map((pi) => ({
        name: pi.ingredient.name,
        amount: Number(pi.amount),
        unit: pi.unit,
      })),
    }));
  }
}
