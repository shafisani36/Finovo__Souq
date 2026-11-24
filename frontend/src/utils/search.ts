import type { SavedSearch } from '../types';

export function savedSearchLink(search: SavedSearch): string {
  const params = new URLSearchParams();
  Object.entries(search.criteria).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `/search?${query}` : '/search';
}
