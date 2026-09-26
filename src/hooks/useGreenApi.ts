import { useState, useEffect, useCallback, useRef } from "react";
import type {
  Credentials,
  Chat,
  Message,
  MessageStatus,
  IncomingNotification,
} from "@/types";
import {
  sendMessage,
  receiveNotification,
  deleteNotification,
  formatChatId,
  getInstanceState,
  getInstanceStateMessage,
  GreenApiError,
} from "@/services/greenApi";
import { apiConfig } from "@/config/api";

interface PersistedChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
}

/**
 * Формирует уникальный ключ localStorage для состояния чатов конкретного инстанса.
 */
const getChatStateStorageKey = (idInstance: string) =>
  `green_api_chat_state_${idInstance}`;

/**
 * Считывает сохранённую историю чатов и сообщений инстанса из localStorage.
 */
const readPersistedChatState = (idInstance: string): PersistedChatState => {
  try {
    const saved = localStorage.getItem(getChatStateStorageKey(idInstance));
    if (!saved) return { chats: [], messages: {} };

    const parsed = JSON.parse(saved) as Partial<PersistedChatState>;
    return {
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      messages:
        parsed.messages && typeof parsed.messages === "object"
          ? parsed.messages
          : {},
    };
  } catch {
    return { chats: [], messages: {} };
  }
};

/**
 * Проверяет, является ли входящее уведомление текстовым сообщением
 * (включая сообщения с телефона и через API).
 */
const isTextMessageNotification = (
  notification: IncomingNotification,
): boolean => {
  const type = notification.body?.typeWebhook;
  const isMessageWebhook =
    type === "incomingMessageReceived" ||
    type === "outgoingMessageReceived" ||
    type === "outgoingAPIMessageReceived";

  const messageType = notification.body?.messageData?.typeMessage ?? "";
  const isTextMessage = ["textMessage", "extendedTextMessage"].includes(
    messageType,
  );

  return isMessageWebhook && isTextMessage;
};

/**
 * Преобразует объект уведомления GREEN-API во внутреннюю модель Message.
 */
const notificationToMessage = (
  notification: IncomingNotification,
  myInstanceId: string,
): Message | null => {
  const body = notification?.body;
  if (!body) return null;

  const { idMessage, senderData, messageData, timestamp, typeWebhook } = body;
  const text =
    messageData?.textMessageData?.textMessage ??
    messageData?.extendedTextMessageData?.text;

  if (
    typeof idMessage !== "string" ||
    !idMessage ||
    typeof senderData?.chatId !== "string" ||
    typeof text !== "string" ||
    !text ||
    typeof timestamp !== "number"
  ) {
    return null;
  }

  const isOutgoing =
    typeWebhook === "outgoingMessageReceived" ||
    typeWebhook === "outgoingAPIMessageReceived" ||
    senderData.sender?.includes(myInstanceId);

  return {
    id: idMessage,
    chatId: senderData.chatId,
    text,
    senderId: senderData.sender || senderData.chatId,
    timestamp: timestamp * 1000,
    isIncoming: !isOutgoing,
    status: isOutgoing ? "sent" : undefined,
  };
};

/**
 * Обновляет статус доставки конкретного исходящего сообщения в массиве.
 */
const applyOutgoingStatus = (
  messages: Message[],
  idMessage: string,
  status: MessageStatus,
): Message[] =>
  messages.map((message) =>
    message.id === idMessage ? { ...message, status } : message,
  );

/**
 * Асинхронная пауза с поддержкой отмены через AbortSignal.
 */
const wait = (delay: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(resolve, delay);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Основной хук для управления состоянием чатов, отправки и long polling получения сообщений.
 */
export const useGreenApi = (credentials: Credentials | null) => {
  // Отслеживает ID инстанса для безопасной синхронизации стейта во время рендера
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(
    () => credentials?.idInstance || null,
  );

  const [chats, setChats] = useState<Chat[]>(() =>
    credentials?.idInstance
      ? readPersistedChatState(credentials.idInstance).chats
      : [],
  );

  const [messages, setMessages] = useState<Record<string, Message[]>>(() =>
    credentials?.idInstance
      ? readPersistedChatState(credentials.idInstance).messages
      : {},
  );

  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  // Синхронизирует стейт при смене инстанса во время рендера
  const nextInstanceId = credentials?.idInstance || null;
  if (nextInstanceId !== activeInstanceId) {
    setActiveInstanceId(nextInstanceId);

    if (nextInstanceId) {
      const persisted = readPersistedChatState(nextInstanceId);
      setChats(persisted.chats);
      setMessages(persisted.messages);
    } else {
      setChats([]);
      setMessages({});
    }
  }

  // Сохраняет актуальное состояние чатов в localStorage
  useEffect(() => {
    if (
      !credentials?.idInstance ||
      credentials.idInstance !== activeInstanceId
    ) {
      return;
    }

    try {
      localStorage.setItem(
        getChatStateStorageKey(credentials.idInstance),
        JSON.stringify({ chats, messages }),
      );
    } catch (storageError) {
      console.warn("Не удалось сохранить состояние чатов", storageError);
    }
  }, [chats, credentials?.idInstance, activeInstanceId, messages]);

  // Синхронизирует состояние между вкладками браузера через событие storage
  useEffect(() => {
    if (!credentials?.idInstance) return;

    const storageKey = getChatStateStorageKey(credentials.idInstance);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as PersistedChatState;
          if (Array.isArray(parsed.chats)) {
            setChats(parsed.chats);
          }
          if (parsed.messages && typeof parsed.messages === "object") {
            setMessages(parsed.messages);
          }
        } catch (err) {
          console.warn("Ошибка при синхронизации вкладок:", err);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [credentials?.idInstance]);

  /**
   * Добавляет сообщение в историю и обновляет список диалогов с дедупликацией.
   */
  const processMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      const existing = prev[message.chatId] || [];
      if (existing.some((m) => m.id === message.id)) {
        return prev;
      }

      return {
        ...prev,
        [message.chatId]: [...existing, message].sort(
          (a, b) => a.timestamp - b.timestamp,
        ),
      };
    });

    setChats((prev) => {
      const chatIndex = prev.findIndex((chat) => chat.id === message.chatId);
      if (chatIndex !== -1) {
        const updated = [...prev];
        updated[chatIndex] = {
          ...updated[chatIndex],
          lastMessage: message,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: message.chatId,
          name: message.chatId,
          lastMessage: message,
        },
      ];
    });
  }, []);

  /**
   * Обновляет статус отправленного сообщения (sent/delivered/read/failed).
   */
  const processOutgoingStatus = useCallback(
    (
      chatId: string,
      idMessage: string,
      status: MessageStatus,
      description?: string,
    ) => {
      setMessages((prev) => {
        const chatMessages = prev[chatId];
        if (!chatMessages?.some((message) => message.id === idMessage)) {
          return prev;
        }

        return {
          ...prev,
          [chatId]: applyOutgoingStatus(chatMessages, idMessage, status),
        };
      });

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId || chat.lastMessage?.id !== idMessage) {
            return chat;
          }
          return {
            ...chat,
            lastMessage: { ...chat.lastMessage, status },
          };
        }),
      );

      if (
        status === "failed" ||
        status === "noAccount" ||
        status === "notInGroup"
      ) {
        setError(
          description
            ? `Не удалось доставить сообщение: ${description}`
            : "Не удалось доставить сообщение получателю.",
        );
      }
    },
    [],
  );

  // Сохраняет ссылку на обработчик сообщений, чтобы не сбрасывать цикл polling при рендерах
  const processMessageRef = useRef(processMessage);
  useEffect(() => {
    processMessageRef.current = processMessage;
  }, [processMessage]);

  /**
   * Создает новый пустой диалог с указанным номером телефона.
   */
  const createChat = useCallback((phoneOrChatId: string, name?: string) => {
    const targetChatId = formatChatId(phoneOrChatId);
    if (!targetChatId) return;

    setChats((prev) => {
      if (prev.some((chat) => chat.id === targetChatId)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: targetChatId,
          name: name || phoneOrChatId.trim(),
        },
      ];
    });

    setMessages((prev) => {
      if (prev[targetChatId]) return prev;
      return { ...prev, [targetChatId]: [] };
    });
  }, []);

  /**
   * Отправляет исходящее текстовое сообщение в указанный чат.
   */
  const sendTextMessage = useCallback(
    async (chatId: string, text: string) => {
      if (!credentials || !text.trim()) return;

      const trimmedText = text.trim();
      const targetChatId = formatChatId(chatId);

      try {
        const idMessage = await sendMessage(credentials, {
          chatId: targetChatId,
          message: trimmedText,
        });

        const newMessage: Message = {
          id: idMessage,
          chatId: targetChatId,
          text: trimmedText,
          senderId: credentials.idInstance,
          timestamp: Date.now(),
          isIncoming: false,
          status: "sent",
        };

        setMessages((prev) => ({
          ...prev,
          [targetChatId]: [...(prev[targetChatId] || []), newMessage].sort(
            (a, b) => a.timestamp - b.timestamp,
          ),
        }));

        setChats((prev) =>
          prev.map((c) =>
            c.id === targetChatId ? { ...c, lastMessage: newMessage } : c,
          ),
        );

        clearError();
      } catch (err) {
        if (err instanceof GreenApiError) {
          setError(err.message);
        } else {
          setError("Не удалось отправить сообщение");
        }
        throw err;
      }
    },
    [credentials, clearError],
  );

  // Фоновый опрос очереди уведомлений (HTTP Long Polling)
  useEffect(() => {
    if (!credentials?.idInstance || !credentials?.apiTokenInstance) return;

    let isActive = true;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const instanceState = await getInstanceState(credentials);
        if (!isActive) return;
        if (instanceState !== "authorized") {
          setError(getInstanceStateMessage(instanceState));
          return;
        }
      } catch (e) {
        console.warn("Первичная проверка статуса инстанса:", e);
      }

      await wait(apiConfig.polling.startupDelayMs, controller.signal);

      while (isActive) {
        try {
          const notification = await receiveNotification(
            credentials,
            apiConfig.polling.receiveTimeout,
            controller.signal,
          );

          if (!isActive) break;

          if (!notification) {
            await wait(apiConfig.polling.interval, controller.signal);
            continue;
          }

          // Обработка статуса доставки сообщения
          if (
            notification.body?.typeWebhook === "outgoingMessageStatus" &&
            notification.body.chatId &&
            notification.body.idMessage &&
            notification.body.status
          ) {
            processOutgoingStatus(
              notification.body.chatId,
              notification.body.idMessage,
              notification.body.status,
              notification.body.description,
            );
          }

          // Обработка текстовых входящих и исходящих сообщений
          if (isTextMessageNotification(notification)) {
            const message = notificationToMessage(
              notification,
              credentials.idInstance,
            );
            if (message) {
              processMessageRef.current(message);
            }
          }

          if (!isActive) break;

          // Подтверждение и удаление уведомления из очереди
          await deleteNotification(credentials, notification.receiptId);

          if (!isActive) break;

          await wait(apiConfig.polling.interval, controller.signal);
        } catch (err) {
          if (!isActive) break;

          if (err instanceof GreenApiError) {
            if (err.statusCode === 429 || err.statusCode === 428) {
              console.warn(`GREEN-API rate-limit (${err.statusCode}).`);
              await wait(
                apiConfig.polling.rateLimitRetryDelayMs,
                controller.signal,
              );
              continue;
            }

            if (err.statusCode === 401 || err.statusCode === 403) {
              setError(err.message);
              break;
            }
          }

          await wait(apiConfig.polling.errorRetryDelayMs, controller.signal);
        }
      }
    };

    void poll();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [credentials, processOutgoingStatus]);

  return {
    chats,
    messages,
    error,
    clearError,
    createChat,
    sendTextMessage,
  };
};
