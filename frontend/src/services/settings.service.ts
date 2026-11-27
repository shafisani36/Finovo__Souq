import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { AdminSettings, LegalPage, LegalPageSlug, SiteSettings } from '../types';

let cachedSettings: Promise<SiteSettings> | null = null;

export const settingsService = {
  /** Contact details, social links, announcement and limits; one request per visit */
  get(): Promise<SiteSettings> {
    if (!cachedSettings) {
      cachedSettings = apiClient.get<SiteSettings>(endpoints.site.settings, { skipAuth: true }).catch((error: unknown) => {
        cachedSettings = null;
        throw error;
      });
    }
    return cachedSettings;
  },

  page(slug: LegalPageSlug): Promise<LegalPage> {
    return apiClient.get<LegalPage>(endpoints.site.page(slug), { skipAuth: true });
  },

  adminGet(): Promise<AdminSettings> {
    return apiClient.get<AdminSettings>(endpoints.admin.settings);
  },

  async adminSave(
    sections: Partial<Pick<AdminSettings, 'contact' | 'social' | 'announcement' | 'listings'> & { promotions: Omit<AdminSettings['promotions'], 'paymentsConfigured'> }>,
  ): Promise<void> {
    await apiClient.patch(endpoints.admin.settings, sections);
    cachedSettings = null;
  },

  adminSavePage(slug: LegalPageSlug, page: { title: string; body: string; titleAr: string; bodyAr: string }): Promise<Omit<LegalPage, 'slug'>> {
    return apiClient.put<Omit<LegalPage, 'slug'>>(endpoints.admin.settingsPage(slug), page);
  },
};
