import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Category } from '../types';

let cachedCategories: Promise<Category[]> | null = null;

export const categoriesService = {
  /** Categories change rarely, so one request is shared for the whole visit */
  list(): Promise<Category[]> {
    if (!cachedCategories) {
      cachedCategories = apiClient.get<Category[]>(endpoints.categories.list, { skipAuth: true }).catch((error: unknown) => {
        cachedCategories = null;
        throw error;
      });
    }
    return cachedCategories;
  },
};
