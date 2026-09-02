import { CategoryFilterType, StoreMode } from '@prisma/client';

export function resolveCategoryFilterType(category: {
  name: string;
  slug?: string | null;
  mode: StoreMode;
  filterType?: CategoryFilterType | null;
}) {
  if (category.mode === StoreMode.food) return CategoryFilterType.food;
  if (category.filterType && category.filterType !== CategoryFilterType.general) {
    return category.filterType;
  }
  const identity = `${category.name} ${category.slug || ''}`.toLowerCase();
  if (/cloth|fashion|apparel|garment|footwear|shoe|wear\b/.test(identity)) {
    return CategoryFilterType.clothing;
  }
  return CategoryFilterType.general;
}
