import type { CategoryIconKey } from '../../types';

const SLUG_TO_ICON: Record<string, CategoryIconKey> = {
  cars: 'car',
  property: 'property',
  electronics: 'electronics',
  'home-furniture': 'furniture',
  services: 'services',
};

export function iconForSlug(slug: string): CategoryIconKey {
  return SLUG_TO_ICON[slug] ?? 'electronics';
}
