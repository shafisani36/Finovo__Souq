/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCK_API?: string;
  readonly VITE_MOCK_PENDING_ENDPOINTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
