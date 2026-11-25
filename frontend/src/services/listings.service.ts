import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type {
  Listing,
  ListingAvailability,
  ListingDraftPayload,
  ListingReport,
  ListingSearchParams,
  Paginated,
  ReportReason,
} from '../types';

export const listingsService = {
  search(params: ListingSearchParams, signal?: AbortSignal): Promise<Paginated<Listing>> {
    return apiClient.get<Paginated<Listing>>(endpoints.listings.search, { params: { ...params }, signal, skipAuth: true });
  },

  getById(id: string): Promise<Listing> {
    return apiClient.get<Listing>(endpoints.listings.byId(id));
  },

  mine(params: { status?: string; page?: number } = {}): Promise<Paginated<Listing>> {
    return apiClient.get<Paginated<Listing>>(endpoints.listings.mine, { params });
  },

  createDraft(payload: ListingDraftPayload): Promise<Listing> {
    return apiClient.post<Listing>(endpoints.listings.create, payload);
  },

  update(id: string, payload: Partial<ListingDraftPayload>): Promise<Listing> {
    return apiClient.patch<Listing>(endpoints.listings.byId(id), payload);
  },

  uploadPhotos(id: string, files: File[]): Promise<Listing> {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    return apiClient.post<Listing>(endpoints.listings.photos(id), formData, { timeoutMs: 60000 });
  },

  deletePhoto(id: string, photoId: string): Promise<Listing> {
    return apiClient.delete<Listing>(endpoints.listings.photo(id, photoId));
  },

  /** Saves the photo order; the first photo becomes the cover */
  reorderPhotos(id: string, photoIds: string[]): Promise<Listing> {
    return apiClient.patch<Listing>(endpoints.listings.photoOrder(id), { photoIds });
  },

  submit(id: string): Promise<Listing> {
    return apiClient.post<Listing>(endpoints.listings.submit(id));
  },

  withdraw(id: string): Promise<Listing> {
    return apiClient.post<Listing>(endpoints.listings.withdraw(id));
  },

  setAvailability(id: string, availability: ListingAvailability): Promise<Listing> {
    return apiClient.patch<Listing>(endpoints.listings.availability(id), { availability });
  },

  report(id: string, reason: ReportReason, details: string): Promise<ListingReport> {
    return apiClient.post<ListingReport>(endpoints.listings.reports(id), { reason, details });
  },
};
