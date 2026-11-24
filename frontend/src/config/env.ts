export const env = {
  /** Absolute URL, or a path such as /api/v1 that the Vite dev server proxies to the backend */
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api/v1',
  /** Everything runs on the in-browser mock API; no backend needed */
  useMockApi: import.meta.env.VITE_USE_MOCK_API === 'true',
  /** Real backend for the endpoints it has (auth), mock API for the endpoints it does not have yet */
  mockPendingEndpoints: import.meta.env.VITE_MOCK_PENDING_ENDPOINTS === 'true',
} as const;
