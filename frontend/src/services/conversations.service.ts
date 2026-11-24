import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Conversation, Message } from '../types';

export const conversationsService = {
  list(): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>(endpoints.conversations.list);
  },

  /** Opens the existing conversation for this listing or starts a new one */
  start(listingId: string): Promise<Conversation> {
    return apiClient.post<Conversation>(endpoints.conversations.list, { listingId });
  },

  messages(conversationId: string): Promise<Message[]> {
    return apiClient.get<Message[]>(endpoints.conversations.messages(conversationId));
  },

  send(conversationId: string, body: string): Promise<Message> {
    return apiClient.post<Message>(endpoints.conversations.messages(conversationId), { body });
  },
};
