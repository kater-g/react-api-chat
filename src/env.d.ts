/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GREEN_API_URL: string;
  readonly VITE_POLLING_INTERVAL?: string;
  readonly VITE_RECEIVE_TIMEOUT?: string;
  readonly VITE_POLLING_STARTUP_DELAY_MS?: string;
  readonly VITE_RATE_LIMIT_RETRY_DELAY_MS?: string;
  readonly VITE_POLLING_ERROR_RETRY_DELAY_MS?: string;
  readonly VITE_ERROR_TOAST_DURATION_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
