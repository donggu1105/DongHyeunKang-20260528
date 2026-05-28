import { PrismaClient } from '@prisma/client';
import { seedStandards } from './seed/standards';
import { seedProducts } from './seed/products';

/**
 * Idempotent reseed against the real database.
 *
 * FK-safe order:
 *   1. deleteMany productIngredient
 *   2. deleteMany intakeReference
 *   3. deleteMany product (cascades AnalysisProduct + AnalysisRecommendation)
 *   4. upsert ingredients by unique name (NOT deleted — avoids cascading
 *      AnalysisResult rows)
 *   5. createMany intake references
 *   6. create products with nested ingredients
 *
 * Running this repeatedly leaves the catalog in the same state.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    // 1–3 + 4–5: clear catalog rows then reseed standards in one transaction.
    // (Ingredients are upserted, never deleted.)
    const standards = await prisma.$transaction(async (tx) => {
      await tx.productIngredient.deleteMany();
      await tx.intakeReference.deleteMany();
      // Cascades AnalysisProduct + AnalysisRecommendation.
      await tx.product.deleteMany();
      return seedStandards(tx);
    });

    // 6: create products + nested ingredients.
    const products = await seedProducts(prisma);

    // Verify by re-counting from the DB (not by trusting in-memory totals).
    const [ingredients, references, productCount, productIngredients] =
      await Promise.all([
        prisma.ingredient.count(),
        prisma.intakeReference.count(),
        prisma.product.count(),
        prisma.productIngredient.count(),
      ]);

    console.log('Seed complete.');
    console.log('  ingredients:        ', ingredients);
    console.log('  intakeReferences:   ', references);
    console.log('  products:           ', productCount);
    console.log('  productIngredients: ', productIngredients);

    // Sanity check: counts returned by the seed functions should match the DB.
    if (
      ingredients !== standards.ingredients ||
      references !== standards.references ||
      productCount !== products.products ||
      productIngredients !== products.productIngredients
    ) {
      throw new Error(
        'Seed count mismatch between in-memory totals and DB counts.',
      );
    }

    await prisma.$disconnect();
  } catch (err) {
    await prisma.$disconnect();
    throw err;
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
