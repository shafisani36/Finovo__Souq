import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { PublicStore, Store, StorePayload } from '../types';

export const storesService = {
  /** The seller's own store, or null if they have not opened one */
  mine(): Promise<Store | null> {
    return apiClient.get<Store | null>(endpoints.stores.mine);
  },

  /** Opens a store; it stays private until our team verifies it */
  create(payload: StorePayload): Promise<Store> {
    return apiClient.post<Store>(endpoints.stores.mine, payload);
  },

  update(payload: Partial<StorePayload>): Promise<Store> {
    return apiClient.patch<Store>(endpoints.stores.mine, payload);
  },

  uploadLogo(file: File): Promise<Store> {
    const form = new FormData();
    form.append('logo', file);
    return apiClient.post<Store>(endpoints.stores.mineLogo, form, { timeoutMs: 60000 });
  },

  removeLogo(): Promise<Store> {
    return apiClient.delete<Store>(endpoints.stores.mineLogo);
  },

  bySlug(slug: string): Promise<PublicStore> {
    return apiClient.get<PublicStore>(endpoints.stores.bySlug(slug), { skipAuth: true });
  },
};
