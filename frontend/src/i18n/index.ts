import { ar } from './ar';

export type Language = 'en' | 'ar';

const STORAGE_KEY = 'finovo-souq-language';

/** Saved choice first, then the browser language; English when neither says Arabic */
function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // Storage can be blocked (private mode, strict settings); fall back to the browser language
  }
  return window.navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

/**
 * The language is fixed for the life of the page: switching saves the choice and reloads,
 * so text built when a module loads (lists, labels, formatters) is always in the right language.
 */
export const language: Language = detectLanguage();
export const isRtl = language === 'ar';
/** Gregorian calendar and Western digits, as most Saudi marketplaces show prices and dates */
export const locale = language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';

/**
 * Translates English source text. The English sentence is the key, so untranslated text
 * falls back to English. Placeholders like {name} are filled from `values`.
 */
export function t(text: string, values?: Record<string, string | number | null | undefined>): string {
  const template = language === 'ar' ? (ar[text] ?? text) : text;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key] ?? '') : match));
}

export function setLanguage(next: Language) {
  if (next === language) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Without storage the choice cannot survive the reload; keep the current language
    return;
  }
  window.location.reload();
}

/** Sets lang and dir on <html> so the browser lays the page out right to left for Arabic */
export function applyDocumentLanguage() {
  document.documentElement.lang = language;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
}

const arabicPlural = new Intl.PluralRules('ar');
const ARABIC_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * Text with a count: `one` for exactly 1, `other` otherwise (in English).
 * The Arabic entry for `other` may hold the six Arabic plural forms separated by "|"
 * (zero|one|two|few|many|other); {count} is filled in.
 */
export function tn(count: number, one: string, other: string, values?: Record<string, string | number | null | undefined>): string {
  const all = { count, ...values };
  if (language !== 'ar') return t(count === 1 ? one : other, all);
  const entry = ar[other];
  if (!entry?.includes('|')) return t(count === 1 ? one : other, all);
  const forms = entry.split('|');
  const form = forms[ARABIC_FORMS.indexOf(arabicPlural.select(count))] ?? forms[forms.length - 1];
  return form.replace(/\{(\w+)\}/g, (match, key: string) => (key in all ? String(all[key as keyof typeof all] ?? '') : match));
}
