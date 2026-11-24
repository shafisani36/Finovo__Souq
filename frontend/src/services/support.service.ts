import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';

export const SUPPORT_TOPICS = ['Buying an item', 'Selling or my ads', 'My account', 'Report a problem', 'Something else'] as const;

export interface SupportMessagePayload {
  name: string;
  email: string;
  topic: (typeof SUPPORT_TOPICS)[number];
  message: string;
}

export const supportService = {
  send(payload: SupportMessagePayload): Promise<{ id: string; receivedAt: string }> {
    return apiClient.post(endpoints.support.messages, payload, { skipAuth: true });
  },
};
