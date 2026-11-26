import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Listing, ListingSearchParams, SavedSearch } from '../types';

export const savedService = {
  listListings(): Promise<Listing[]> {
    return apiClient.get<Listing[]>(endpoints.users.savedListings);
  },

  saveListing(listingId: string): Promise<void> {
    return apiClient.post<void>(endpoints.users.savedListing(listingId));
  },

  removeListing(listingId: string): Promise<void> {
    return apiClient.delete<void>(endpoints.users.savedListing(listingId));
  },

  listSearches(): Promise<SavedSearch[]> {
    return apiClient.get<SavedSearch[]>(endpoints.users.savedSearches);
  },

  saveSearch(label: string, criteria: ListingSearchParams): Promise<SavedSearch> {
    return apiClient.post<SavedSearch>(endpoints.users.savedSearches, { label, criteria });
  },

  setSearchAlerts(id: string, alertsEnabled: boolean): Promise<SavedSearch> {
    return apiClient.patch<SavedSearch>(endpoints.users.savedSearch(id), { alertsEnabled });
  },

  removeSearch(id: string): Promise<void> {
    return apiClient.delete<void>(endpoints.users.savedSearch(id));
  },
};
