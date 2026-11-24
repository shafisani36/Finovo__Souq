import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Listing, ListingReport, Paginated, ReportStatus, User, UserStatus } from '../types';

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

  users(params: { q?: string; role?: string; status?: string; page?: number }): Promise<Paginated<User>> {
    return apiClient.get<Paginated<User>>(endpoints.admin.users, { params });
  },

  setUserStatus(userId: string, status: UserStatus, reason: string): Promise<User> {
    return apiClient.patch<User>(endpoints.admin.userStatus(userId), { status, reason });
  },

  reports(params: { status?: string; page?: number }): Promise<Paginated<ListingReport>> {
    return apiClient.get<Paginated<ListingReport>>(endpoints.admin.reports, { params });
  },

  setReportStatus(reportId: string, status: ReportStatus): Promise<ListingReport> {
    return apiClient.patch<ListingReport>(endpoints.admin.reportStatus(reportId), { status });
  },
};
