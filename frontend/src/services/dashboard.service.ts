import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { AdminDashboard, UserDashboard } from '../types';

export type DashboardRange = '7d' | '30d' | '90d';

export const dashboardService = {
  admin(range: DashboardRange): Promise<AdminDashboard> {
    return apiClient.get<AdminDashboard>(endpoints.dashboards.admin, { params: { range } });
  },

  user(range: DashboardRange): Promise<UserDashboard> {
    return apiClient.get<UserDashboard>(endpoints.dashboards.user, { params: { range } });
  },
};
