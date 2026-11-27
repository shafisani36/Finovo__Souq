import { language, t } from './index';

type Json = unknown;

const localName = (name: unknown, nameAr: unknown) => (typeof nameAr === 'string' && nameAr ? nameAr : typeof name === 'string' ? t(name) : name);

/**
 * On the Arabic site, swaps the display text inside API data for its Arabic form: category names
 * (the admin's Arabic name, else the translation), breadcrumb names, and category field labels and units.
 * Values that are sent back to the API (slugs, option values, cities) are never changed.
 */
function walk(value: Json): Json {
  if (Array.isArray(value)) {
    value.forEach(walk);
    return value;
  }
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;

  if (typeof obj.categoryName === 'string') obj.categoryName = localName(obj.categoryName, obj.categoryNameAr);
  // A category, or a breadcrumb step: both carry an Arabic name next to the English one
  if (typeof obj.name === 'string' && 'nameAr' in obj && 'slug' in obj) obj.name = localName(obj.name, obj.nameAr);
  // A category field definition
  if (typeof obj.fieldKey === 'string') {
    if (typeof obj.label === 'string') obj.label = t(obj.label);
    if (typeof obj.unit === 'string' && obj.unit) obj.unit = t(obj.unit);
    if (typeof obj.placeholder === 'string' && obj.placeholder) obj.placeholder = t(obj.placeholder);
  }
  if (typeof obj.description === 'string' && 'nameAr' in obj && obj.description) obj.description = t(obj.description);

  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (child && typeof child === 'object') walk(child);
  }
  return value;
}

/** Admin category editing needs the stored English text, so it is left untouched */
export function localizeResponse<T>(path: string, data: T): T {
  if (language !== 'ar' || path.startsWith('/admin/categories')) return data;
  return walk(data) as T;
}
