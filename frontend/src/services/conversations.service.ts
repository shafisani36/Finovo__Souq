import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Conversation, Message, MessagePage } from '../types';

export const conversationsService = {
  list(): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>(endpoints.conversations.list);
  },

  /** Opens the existing conversation for this listing or starts a new one */
  start(listingId: string): Promise<Conversation> {
    return apiClient.post<Conversation>(endpoints.conversations.list, { listingId });
  },

  /** Latest messages, or older ones when `before` is a message id; loading the latest page marks them read */
  messages(conversationId: string, before?: string): Promise<MessagePage> {
    return apiClient.get<MessagePage>(endpoints.conversations.messages(conversationId), { params: { before } });
  },

  send(conversationId: string, body: string): Promise<Message> {
    return apiClient.post<Message>(endpoints.conversations.messages(conversationId), { body });
  },

  /** Photo or voice message; voice messages need their length in seconds */
  sendAttachment(conversationId: string, file: Blob, kind: 'image' | 'voice', duration?: number): Promise<Message> {
    const form = new FormData();
    form.append('kind', kind);
    if (duration) form.append('duration', String(Math.round(duration)));
    form.append('file', file, kind === 'voice' ? 'voice-message' : file instanceof File ? file.name : 'photo');
    return apiClient.post<Message>(endpoints.conversations.attachments(conversationId), form, { timeoutMs: 60000 });
  },

  markRead(conversationId: string): Promise<void> {
    return apiClient.post<void>(endpoints.conversations.read(conversationId));
  },

  deleteMessage(conversationId: string, messageId: string): Promise<Message> {
    return apiClient.delete<Message>(endpoints.conversations.message(conversationId, messageId));
  },

  setBlocked(conversationId: string, blocked: boolean): Promise<void> {
    const path = endpoints.conversations.block(conversationId);
    return blocked ? apiClient.post<void>(path) : apiClient.delete<void>(path);
  },
};
