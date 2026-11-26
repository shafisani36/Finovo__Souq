import type { Category } from '../types';

/** Direct subcategories, in the order the API returned them (the admin's order) */
export function childrenOf(categories: Category[], parentId: string | null): Category[] {
  return categories.filter((c) => c.parentId === parentId);
}

/** The category and every category above it, top-level first */
export function trailOf(categories: Category[], category: Category | undefined): Category[] {
  if (!category) return [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  return category.path.map((id) => byId.get(id)).filter((c): c is Category => Boolean(c));
}

/** URL keys of the browse filters a category offers */
export function filterKeysOf(category: Category | undefined): string[] {
  if (!category) return [];
  return category.fields
    .filter((f) => f.filterable)
    .flatMap((f) => (f.inputType === 'number' ? [`f_${f.fieldKey}_min`, `f_${f.fieldKey}_max`] : [`f_${f.fieldKey}`]));
}
