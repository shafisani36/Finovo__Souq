import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { AdminCategory, CategoryPayload, Listing, ListingReport, ModerationLogEntry, Paginated, ReportStatus, User, UserStatus } from '../types';
import { categoriesService } from './categories.service';

export const adminService = {
  moderationQueue(params: { status?: string; category?: string; q?: string; page?: number }): Promise<Paginated<Listing>> {
    return apiClient.get<Paginated<Listing>>(endpoints.admin.moderationQueue, { params });
  },

  approve(listingId: string): Promise<Listing> {
    return apiClient.post<Listing>(endpoints.admin.approve(listingId));
  },

  /** mode "changes" asks the seller to fix the ad; mode "reject" closes it */
  reject(listingId: string, reason: string, mode: 'changes' | 'reject'): Promise<Listing> {
    return apiClient.post<Listing>(endpoints.admin.reject(listingId), { reason, mode });
  },

  hide(listingId: string, reason: string): Promise<Listing> {
    return apiClient.post<Listing>(endpoints.admin.hide(listingId), { reason });
  },

  users(params: { q?: string; role?: string; accountType?: string; status?: string; page?: number }): Promise<Paginated<User>> {
    return apiClient.get<Paginated<User>>(endpoints.admin.users, { params });
  },

  /** emailSent is false when the approval email could not be sent */
  approveUser(userId: string): Promise<{ user: User; emailSent: boolean }> {
    return apiClient.post<{ user: User; emailSent: boolean }>(endpoints.admin.approveUser(userId));
  },

  setUserStatus(userId: string, status: UserStatus, reason: string): Promise<User> {
    return apiClient.patch<User>(endpoints.admin.userStatus(userId), { status, reason });
  },

  history(params: { type?: string; page?: number }): Promise<Paginated<ModerationLogEntry>> {
    return apiClient.get<Paginated<ModerationLogEntry>>(endpoints.admin.history, { params });
  },

  promotions(): Promise<Listing[]> {
    return apiClient.get<Listing[]>(endpoints.admin.promotions);
  },

  feature(listingId: string, days: number): Promise<Listing> {
    return apiClient.post<Listing>(endpoints.admin.feature(listingId), { days });
  },

  stopFeature(listingId: string): Promise<Listing> {
    return apiClient.delete<Listing>(endpoints.admin.feature(listingId));
  },

  categories(): Promise<AdminCategory[]> {
    return apiClient.get<AdminCategory[]>(endpoints.admin.categories);
  },

  // Every change clears the cached public tree so menus and pickers show it straight away
  async createCategory(payload: CategoryPayload): Promise<void> {
    await apiClient.post(endpoints.admin.categories, payload);
    categoriesService.clearCache();
  },

  async updateCategory(id: string, payload: CategoryPayload): Promise<void> {
    await apiClient.patch(endpoints.admin.category(id), payload);
    categoriesService.clearCache();
  },

  async reorderCategories(parentId: string | null, ids: string[]): Promise<void> {
    await apiClient.post(endpoints.admin.categoryOrder, { parentId, ids });
    categoriesService.clearCache();
  },

  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(endpoints.admin.category(id));
    categoriesService.clearCache();
  },

  reports(params: { status?: string; page?: number }): Promise<Paginated<ListingReport>> {
    return apiClient.get<Paginated<ListingReport>>(endpoints.admin.reports, { params });
  },

  setReportStatus(reportId: string, status: ReportStatus): Promise<ListingReport> {
    return apiClient.patch<ListingReport>(endpoints.admin.reportStatus(reportId), { status });
  },
};
