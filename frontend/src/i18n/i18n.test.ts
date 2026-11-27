import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async (lang: 'en' | 'ar') => {
  window.localStorage.setItem('finovo-souq-language', lang);
  vi.resetModules();
  return import('./index');
};

afterEach(() => window.localStorage.clear());

describe('i18n', () => {
  it('keeps English text and fills placeholders', async () => {
    const { t, tn, isRtl } = await load('en');
    expect(isRtl).toBe(false);
    expect(t('Featured until {featuredUntil}.', { featuredUntil: '3 Dec' })).toBe('Featured until 3 Dec.');
    expect(tn(1, '{count} ad', '{count} ads')).toBe('1 ad');
    expect(tn(4, '{count} ad', '{count} ads')).toBe('4 ads');
  });

  it('translates to Arabic with the right plural form and falls back to English', async () => {
    const { t, tn, isRtl } = await load('ar');
    expect(isRtl).toBe(true);
    expect(t('Post an ad')).toBe('أضف إعلانًا');
    expect(t('Text we have not translated')).toBe('Text we have not translated');
    expect(tn(1, '{count} ad', '{count} ads')).toBe('إعلان واحد');
    expect(tn(2, '{count} ad', '{count} ads')).toBe('إعلانان');
    expect(tn(5, '{count} ad', '{count} ads')).toBe('5 إعلانات');
    expect(tn(15, '{count} ad', '{count} ads')).toBe('15 إعلانًا');
  });

  it('only shows Arabic category names on the Arabic site', async () => {
    await load('ar');
    const { localizeResponse } = await import('./localize');
    const data = localizeResponse('/categories', [{ name: 'Cars', nameAr: '', slug: 'cars', fields: [{ fieldKey: 'make', label: 'Make', options: ['Toyota'] }] }]);
    expect(data[0].name).toBe('السيارات');
    expect(data[0].fields[0].label).toBe('الشركة المصنعة');
    expect(data[0].fields[0].options).toEqual(['Toyota']);
    const admin = localizeResponse('/admin/categories', [{ name: 'Cars', nameAr: '', slug: 'cars' }]);
    expect(admin[0].name).toBe('Cars');
  });
});
