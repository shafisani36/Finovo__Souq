export const env = {
  /** Absolute URL, or a path such as /api/v1 that the Vite dev server (or a reverse proxy) sends to the backend */
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api/v1',
} as const;
