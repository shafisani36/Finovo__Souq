import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Payment } from '../types';

export const paymentsService = {
  /** Returns the Stripe Checkout address; the price is decided by the server */
  async startPromotion(listingId: string, days: number): Promise<string> {
    const { url } = await apiClient.post<{ url: string }>(endpoints.payments.promotions, { listingId, days });
    return url;
  },

  /** Called on the return from Stripe so the promotion shows at once */
  confirmPromotion(sessionId: string): Promise<Payment> {
    return apiClient.get<Payment>(endpoints.payments.confirmPromotion, { params: { session_id: sessionId } });
  },
};
