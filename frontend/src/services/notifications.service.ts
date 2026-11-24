import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { AppNotification } from '../types';

export const notificationsService = {
  list(): Promise<AppNotification[]> {
    return apiClient.get<AppNotification[]>(endpoints.notifications.list);
  },

  markRead(id: string): Promise<void> {
    return apiClient.patch<void>(endpoints.notifications.markRead(id));
  },
};
