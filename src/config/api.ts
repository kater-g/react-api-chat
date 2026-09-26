/**
 * Глобальная конфигурация приложения и сетевых параметров GREEN-API.
 */
export const apiConfig = {
  apiUrl: import.meta.env.VITE_GREEN_API_URL,

  polling: {
    interval: Number(import.meta.env.VITE_POLLING_INTERVAL) || 3000,
    receiveTimeout: Number(import.meta.env.VITE_RECEIVE_TIMEOUT) || 5,
    startupDelayMs:
      Number(import.meta.env.VITE_POLLING_STARTUP_DELAY_MS) || 1000,
    rateLimitRetryDelayMs:
      Number(import.meta.env.VITE_RATE_LIMIT_RETRY_DELAY_MS) || 5000,
    errorRetryDelayMs:
      Number(import.meta.env.VITE_POLLING_ERROR_RETRY_DELAY_MS) || 3500,
  },

  ui: {
    errorToastDurationMs:
      Number(import.meta.env.VITE_ERROR_TOAST_DURATION_MS) || 5000,
  },
} as const;

/**
 * Проверяет наличие критических переменных окружения при старте приложения.
 */
export const validateConfig = () => {
  const missing: string[] = [];

  if (!apiConfig.apiUrl) {
    missing.push("VITE_GREEN_API_URL");
  }

  if (missing.length > 0) {
    throw new Error(
      `Отсутствуют переменные окружения: ${missing.join(", ")}. ` +
        `Скопируйте .env.example в .env и заполните значения.`,
    );
  }
};
