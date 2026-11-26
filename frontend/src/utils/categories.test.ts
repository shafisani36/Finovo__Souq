import { describe, expect, it } from 'vitest';
import type { Category } from '../types';
import { childrenOf, filterKeysOf, trailOf } from './categories';

const node = (id: string, parentId: string | null, path: string[], extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  slug: id,
  parentId,
  depth: path.length - 1,
  path,
  icon: 'tag',
  description: '',
  isLeaf: true,
  listingTypes: ['sale'],
  fields: [],
  listingCount: 0,
  ...extra,
});

const tree = [
  node('electronics', null, ['electronics'], { isLeaf: false }),
  node('computers', 'electronics', ['electronics', 'computers'], { isLeaf: false }),
  node('laptops', 'computers', ['electronics', 'computers', 'laptops']),
  node('phones', 'electronics', ['electronics', 'phones']),
  node('vehicles', null, ['vehicles']),
];

describe('category helpers', () => {
  it('lists direct children only, in order', () => {
    expect(childrenOf(tree, null).map((c) => c.id)).toEqual(['electronics', 'vehicles']);
    expect(childrenOf(tree, 'electronics').map((c) => c.id)).toEqual(['computers', 'phones']);
  });

  it('builds the breadcrumb trail from the top level down', () => {
    expect(trailOf(tree, tree[2]).map((c) => c.id)).toEqual(['electronics', 'computers', 'laptops']);
    expect(trailOf(tree, undefined)).toEqual([]);
  });

  it('turns filterable fields into URL keys', () => {
    const cars = node('cars', null, ['cars'], {
      fields: [
        { fieldKey: 'make', label: 'Make', inputType: 'select', required: true, filterable: true, options: ['Toyota'] },
        { fieldKey: 'year', label: 'Year', inputType: 'number', required: true, filterable: true },
        { fieldKey: 'model', label: 'Model', inputType: 'text', required: true, filterable: false },
      ],
    });
    expect(filterKeysOf(cars)).toEqual(['f_make', 'f_year_min', 'f_year_max']);
  });
});
