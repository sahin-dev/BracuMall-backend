import 'dotenv/config';
import {
  PrismaClient,
  ProductType,
  StoreMode,
  type Category,
} from '@prisma/client';

const prisma = new PrismaClient();

function inferredMode(category: Category): StoreMode {
  const looksLikeFood =
    category.slug.trim().toLowerCase() === 'food' ||
    category.name.trim().toLowerCase() === 'food';
  if (looksLikeFood) return StoreMode.food;
  return category.mode || StoreMode.general;
}

function requiredProductType(mode: StoreMode): ProductType | null {
  if (mode === StoreMode.hybrid) return null;
  return mode === StoreMode.food ? ProductType.food : ProductType.general;
}

async function reconcileCategoryModes() {
  const categories = await prisma.category.findMany();
  let storesUpdated = 0;
  let productsReclassified = 0;
  let productsPaused = 0;

  for (const category of categories) {
    const mode = inferredMode(category);
    await prisma.category.update({
      where: { id: category.id },
      data: { mode },
    });

    const stores = await prisma.store.findMany({
      where: { categoryId: category.id },
      select: { id: true },
    });
    if (stores.length === 0) continue;

    const storeIds = stores.map((store) => store.id);
    const updatedStores = await prisma.store.updateMany({
      where: { id: { in: storeIds } },
      data: { mode, categoryName: category.name },
    });
    storesUpdated += updatedStores.count;

    const updatedProducts = await prisma.product.updateMany({
      where: { storeId: { in: storeIds } },
      data: { categoryId: category.id, categoryName: category.name },
    });
    productsReclassified += updatedProducts.count;

    const requiredType = requiredProductType(mode);
    if (requiredType) {
      const pausedProducts = await prisma.product.updateMany({
        where: {
          storeId: { in: storeIds },
          productType: { not: requiredType },
          isActive: true,
        },
        data: { isActive: false },
      });
      productsPaused += pausedProducts.count;
    }
  }

  console.log(
    `Category reconciliation complete: ${categories.length} categories, ${storesUpdated} stores updated, ${productsReclassified} products reclassified, ${productsPaused} incompatible products paused`,
  );
}

reconcileCategoryModes()
  .catch((error: unknown) => {
    console.error('Category reconciliation failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
