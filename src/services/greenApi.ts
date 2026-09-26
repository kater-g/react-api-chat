import type {
  Credentials,
  SendMessageParams,
  IncomingNotification,
} from "@/types";
import { MAX_MESSAGE_LENGTH } from "@/types";

/**
 * Пользовательская ошибка сетевого слоя GREEN-API с кодом статуса и описанием.
 */
export class GreenApiError extends Error {
  statusCode?: number;
  errorCode?: string;

  constructor(message: string, statusCode?: number, errorCode?: string) {
    super(message);
    this.name = "GreenApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export type InstanceState =
  | "authorized"
  | "notAuthorized"
  | "starting"
  | "sleepMode"
  | "blocked"
  | "suspended"
  | string;

interface CachedInstanceStateRequest {
  promise: Promise<InstanceState>;
  settledAt: number | null;
}

const INSTANCE_STATE_CACHE_WINDOW_MS = 1100;
const instanceStateRequests = new WeakMap<
  Credentials,
  CachedInstanceStateRequest
>();

/**
 * Возвращает понятное пользователю описание текущего статуса инстанса.
 */
export const getInstanceStateMessage = (state: InstanceState): string => {
  switch (state) {
    case "notAuthorized":
      return "Инстанс WhatsApp не авторизован. Подключите его в личном кабинете GREEN-API и повторите вход.";
    case "starting":
      return "Инстанс запускается. Подождите несколько минут и повторите вход.";
    case "sleepMode":
      return "Инстанс WhatsApp спит. Проверьте подключение телефона к интернету.";
    case "blocked":
      return "Инстанс заблокирован. Проверьте его состояние в личном кабинете GREEN-API.";
    case "suspended":
      return "На инстансе действуют временные ограничения. Проверьте личный кабинет GREEN-API.";
    default:
      return `Неизвестное состояние инстанса: ${state}`;
  }
};

/**
 * Удаляет замыкающий слеш из URL-адреса API.
 */
const normalizeApiUrl = (url: string): string => {
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

/**
 * Формирует базовый адрес WhatsApp-инстанса для запросов.
 */
export const buildInstanceUrl = (credentials: Credentials): string => {
  const normalizedUrl = normalizeApiUrl(credentials.apiUrl);
  return `${normalizedUrl}/waInstance${credentials.idInstance}`;
};

/**
 * Преобразует телефонный номер или сырой идентификатор в формат WhatsApp chatId.
 */
export const formatChatId = (rawPhoneOrId: string): string => {
  const trimmed = rawPhoneOrId.trim();
  if (!trimmed) return "";

  if (trimmed.includes("@")) {
    return trimmed;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  return digitsOnly ? `${digitsOnly}@c.us` : "";
};

/**
 * Безопасно парсит JSON-ответ от сервера, исключая сбои при пустом теле.
 */
const parseJsonSafe = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
};

/**
 * Выполняет сетевой запрос для получения текущего состояния инстанса.
 */
const requestInstanceState = async (
  credentials: Credentials,
): Promise<InstanceState> => {
  const base = buildInstanceUrl(credentials);
  const url = `${base}/getStateInstance/${credentials.apiTokenInstance}`;

  try {
    const response = await fetch(url, { method: "GET" });
    const data = await parseJsonSafe(response);

    if (!response.ok) {
      if (response.status === 429) {
        throw new GreenApiError(
          "GREEN-API ограничил частоту проверки инстанса. Подождите несколько секунд и повторите попытку.",
          429,
        );
      }
      if (response.status === 401) {
        const detail =
          typeof data.message === "string"
            ? ` Ответ GREEN-API: ${data.message}`
            : "";
        throw new GreenApiError(
          "GREEN-API вернул 401 Unauthorized. Проверьте, что apiUrl, idInstance и apiTokenInstance относятся к одному инстансу в личном кабинете. " +
            "Токен может быть действующим, но принадлежать другому инстансу." +
            detail,
          401,
        );
      }
      if (response.status === 403) {
        const detail =
          typeof data.message === "string"
            ? ` Ответ GREEN-API: ${data.message}`
            : "";
        throw new GreenApiError(
          "GREEN-API вернул 403 Forbidden. Сверьте apiUrl и idInstance с данными этого инстанса в личном кабинете." +
            detail,
          403,
        );
      }
      throw new GreenApiError(
        (data.message as string) ||
          `Не удалось проверить состояние инстанса: ${response.status}`,
        response.status,
      );
    }

    if (typeof data.stateInstance !== "string") {
      throw new GreenApiError(
        "GREEN-API вернул некорректное состояние инстанса",
      );
    }

    return data.stateInstance;
  } catch (error) {
    if (error instanceof GreenApiError) throw error;
    throw new GreenApiError(
      "Не удалось подключиться к GREEN-API. Проверьте интернет-соединение и apiUrl. Если они указаны верно, сверьте idInstance и apiTokenInstance.",
    );
  }
};

/**
 * Запрашивает состояние инстанса с дедупликацией параллельных запросов через короткий кэш.
 */
export const getInstanceState = (
  credentials: Credentials,
): Promise<InstanceState> => {
  const now = Date.now();
  const cached = instanceStateRequests.get(credentials);

  if (
    cached &&
    (cached.settledAt === null ||
      now - cached.settledAt < INSTANCE_STATE_CACHE_WINDOW_MS)
  ) {
    return cached.promise;
  }

  const request: CachedInstanceStateRequest = {
    promise: requestInstanceState(credentials),
    settledAt: null,
  };
  instanceStateRequests.set(credentials, request);
  void request.promise.then(
    () => {
      request.settledAt = Date.now();
    },
    () => {
      request.settledAt = Date.now();
    },
  );

  return request.promise;
};

export interface MessagingSettings {
  incomingWebhook?: string;
  outgoingWebhook?: string;
  outgoingAPIMessageWebhook?: string;
}

/**
 * Запрашивает настройки вебхуков инстанса для валидации перед началом работы.
 */
export const getMessagingSettings = async (
  credentials: Credentials,
): Promise<MessagingSettings> => {
  const url = `${buildInstanceUrl(credentials)}/getSettings/${credentials.apiTokenInstance}`;

  try {
    const response = await fetch(url, { method: "GET" });
    const data = await parseJsonSafe(response);

    if (!response.ok) {
      throw new GreenApiError(
        (data.message as string) ||
          `Не удалось проверить webhook-настройки: ${response.status}`,
        response.status,
      );
    }

    return data as MessagingSettings;
  } catch (error) {
    if (error instanceof GreenApiError) throw error;
    throw new GreenApiError(
      "Не удалось проверить настройки получения сообщений GREEN-API.",
    );
  }
};

/**
 * Отправляет текстовое сообщение через метод API sendMessage.
 */
export const sendMessage = async (
  credentials: Credentials,
  params: SendMessageParams,
): Promise<string> => {
  if (!params.message || params.message.length > MAX_MESSAGE_LENGTH) {
    throw new GreenApiError(
      `Сообщение должно содержать от 1 до ${MAX_MESSAGE_LENGTH} символов`,
      400,
    );
  }

  if (
    params.typingTime != null &&
    (params.typingTime < 1000 || params.typingTime > 20000)
  ) {
    throw new GreenApiError(
      "Время набора должно быть от 1000 до 20000 мс",
      400,
    );
  }

  const base = buildInstanceUrl(credentials);
  const url = `${base}/sendMessage/${credentials.apiTokenInstance}`;

  const body: SendMessageParams = {
    chatId: formatChatId(params.chatId),
    message: params.message,
  };

  if (params.typingTime) body.typingTime = params.typingTime;
  if (params.quotedMessageId) body.quotedMessageId = params.quotedMessageId;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await parseJsonSafe(response);

    if (!response.ok) {
      if (response.status === 400) {
        throw new GreenApiError(
          (data.message as string) || "Ошибка валидации запроса",
          400,
          data.error as string | undefined,
        );
      }
      if (response.status === 403) {
        throw new GreenApiError(
          "На аккаунте временные ограничения. Попробуйте позже.",
          403,
        );
      }
      if (response.status === 429) {
        throw new GreenApiError(
          "Слишком много запросов. Подождите немного.",
          429,
        );
      }
      throw new GreenApiError(
        `Ошибка сервера: ${response.status}`,
        response.status,
      );
    }

    if (typeof data.idMessage !== "string" || !data.idMessage) {
      throw new GreenApiError(
        "Некорректный ответ сервера: отсутствует idMessage",
        500,
      );
    }

    return data.idMessage;
  } catch (error) {
    if (error instanceof GreenApiError) throw error;
    throw new GreenApiError(
      "Не удалось отправить сообщение. Проверьте интернет-соединение.",
    );
  }
};

/**
 * Получает очередное входящее уведомление из очереди HTTP Long Polling.
 */
export const receiveNotification = async (
  credentials: Credentials,
  receiveTimeout: number = 5,
  signal?: AbortSignal,
): Promise<IncomingNotification | null> => {
  if (receiveTimeout < 5 || receiveTimeout > 60) {
    throw new GreenApiError(
      "receiveTimeout должен быть от 5 до 60 секунд",
      400,
    );
  }

  const base = buildInstanceUrl(credentials);
  const url = `${base}/receiveNotification/${credentials.apiTokenInstance}?receiveTimeout=${receiveTimeout}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      signal,
    });

    if (response.status === 204) {
      return null;
    }

    const data = await parseJsonSafe(response);

    if (!response.ok) {
      const message = data.message as string | undefined;

      if (response.status === 400 && message?.includes("webhook url")) {
        throw new GreenApiError(
          "В настройках инстанса указан Webhook URL. " +
            "Для работы через polling очистите его в личном кабинете " +
            "и подождите около 1 минуты.",
          400,
        );
      }

      if (response.status === 400) {
        throw new GreenApiError(message || "Ошибка валидации запроса", 400);
      }
      if (response.status === 401) {
        throw new GreenApiError(
          "GREEN-API отклонил apiTokenInstance. Проверьте токен этого инстанса.",
          401,
        );
      }
      if (response.status === 403) {
        throw new GreenApiError(
          "GREEN-API отклонил idInstance или apiUrl. Сверьте параметры в личном кабинете.",
          403,
        );
      }

      throw new GreenApiError(
        `Ошибка получения уведомлений: ${response.status}`,
        response.status,
      );
    }

    if (Object.keys(data).length === 0) {
      return null;
    }

    return data as unknown as IncomingNotification;
  } catch (error) {
    if (error instanceof GreenApiError) throw error;
    throw new GreenApiError(
      "Не удалось получить сообщения. Проверьте интернет-соединение.",
    );
  }
};

/**
 * Подтверждает и удаляет обработанное уведомление из очереди инстанса.
 */
export const deleteNotification = async (
  credentials: Credentials,
  receiptId: number,
): Promise<boolean> => {
  const base = buildInstanceUrl(credentials);
  const url = `${base}/deleteNotification/${credentials.apiTokenInstance}/${receiptId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      console.error(
        `Не удалось удалить уведомление ${receiptId}: ${response.status}`,
      );

      if (response.status === 401 || response.status === 403) {
        throw new GreenApiError(
          "Не удалось подтвердить получение уведомления. Проверьте токен API.",
          response.status,
        );
      }

      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof GreenApiError) throw error;
    console.error("Ошибка при удалении уведомления:", error);
    return false;
  }
};
