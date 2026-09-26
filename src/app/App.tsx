import { useState, useEffect, useMemo, useCallback } from "react";
import type { Credentials } from "@/types";
import { useGreenApi } from "@/hooks/useGreenApi";
import { LoginForm, ChatList, ChatWindow } from "@/components";
import {
  getInstanceState,
  getInstanceStateMessage,
  getMessagingSettings,
  formatChatId,
} from "@/services/greenApi";
import { apiConfig } from "@/config/api";
import styles from "./App.module.css";

const CREDENTIALS_STORAGE_KEY = "green_api_credentials";
const ACTIVE_CHAT_STORAGE_PREFIX = "green_api_active_chat_";

/**
 * Считывает идентификатор ранее выбранного активного чата для указанного инстанса.
 */
const readActiveChatId = (idInstance?: string): string | null => {
  if (!idInstance) return null;
  try {
    return localStorage.getItem(`${ACTIVE_CHAT_STORAGE_PREFIX}${idInstance}`);
  } catch {
    return null;
  }
};

/**
 * Корневой компонент приложения: управляет авторизацией, экранами и активным диалогом.
 */
const App = () => {
  // Восстанавливает сохраненные учетные данные без падения при повреждении JSON
  const [credentials, setCredentials] = useState<Credentials | null>(() => {
    try {
      const saved = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Credentials) : null;
    } catch {
      return null;
    }
  });

  const [activeChatId, setActiveChatId] = useState<string | null>(() =>
    readActiveChatId(credentials?.idInstance),
  );
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Инициализирует хук интеграции с GREEN-API
  const { chats, messages, error, clearError, createChat, sendTextMessage } =
    useGreenApi(credentials);

  // Переключает активный диалог и сохраняет выбор в localStorage
  const handleSelectChat = useCallback(
    (chatId: string | null) => {
      setActiveChatId(chatId);
      const idInstance = credentials?.idInstance;
      if (!idInstance) return;

      try {
        const key = `${ACTIVE_CHAT_STORAGE_PREFIX}${idInstance}`;
        if (chatId) {
          localStorage.setItem(key, chatId);
        } else {
          localStorage.removeItem(key);
        }
      } catch (storageError) {
        console.warn("Не удалось сохранить выбранный чат", storageError);
      }
    },
    [credentials?.idInstance],
  );

  // Выполняет валидацию инстанса и сохраняет учетные данные
  const handleLogin = async (creds: Credentials) => {
    setIsLoginLoading(true);
    setLoginError(null);

    try {
      // Проверяет статус авторизации инстанса в WhatsApp
      const state = await getInstanceState(creds);
      if (state !== "authorized") {
        setLoginError(getInstanceStateMessage(state));
        return;
      }

      // Проверяет флаги вебхуков для корректной работы входящей очереди
      const settings = await getMessagingSettings(creds);
      const missingSettings = [
        settings.incomingWebhook !== "yes" &&
          "входящие сообщения (incomingWebhook)",
        settings.outgoingWebhook !== "yes" &&
          "статусы доставки/read (outgoingWebhook)",
        settings.outgoingAPIMessageWebhook !== "yes" &&
          "статусы сообщений, отправленных через API (outgoingAPIMessageWebhook)",
      ].filter((setting): setting is string => Boolean(setting));

      if (missingSettings.length > 0) {
        setLoginError(
          `В настройках GREEN-API включите: ${missingSettings.join(", ")}. После изменения настроек дождитесь перезапуска инстанса и войдите снова.`,
        );
        return;
      }

      localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
      setCredentials(creds);
      setActiveChatId(readActiveChatId(creds.idInstance));
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Не удалось проверить подключение к GREEN-API",
      );
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Очищает сессию и локальное хранилище
  const handleLogout = useCallback(() => {
    setCredentials(null);
    setActiveChatId(null);
    try {
      localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
    } catch (e) {
      console.error("Ошибка при очистке localStorage", e);
    }
  }, []);

  // Создает новый диалог и сразу делает его активным
  const handleCreateChat = useCallback(
    (phoneNumber: string) => {
      createChat(phoneNumber);
      handleSelectChat(formatChatId(phoneNumber));
    },
    [createChat, handleSelectChat],
  );

  // Отправляет сообщение в текущий выбранный чат
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!activeChatId) return;
      await sendTextMessage(activeChatId, text);
    },
    [activeChatId, sendTextMessage],
  );

  // Мемоизирует объект активного чата
  const activeChat = useMemo(() => {
    if (!activeChatId) return null;
    return chats.find((c) => c.id === activeChatId) || null;
  }, [chats, activeChatId]);

  // Мемоизирует список сообщений текущего диалога
  const activeMessages = useMemo(() => {
    if (!activeChatId) return [];
    return messages[activeChatId] || [];
  }, [messages, activeChatId]);

  // Скрывает всплывающее уведомление об ошибке по таймауту
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, apiConfig.ui.errorToastDurationMs);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  if (!credentials) {
    return (
      <LoginForm
        onLogin={handleLogin}
        isLoading={isLoginLoading}
        error={loginError}
      />
    );
  }

  return (
    <div className={styles.app}>
      {error && (
        <div className={styles["app__toast"]} role="alert">
          <span>{error}</span>
          <button
            type="button"
            className={styles["app__toast-close-button"]}
            onClick={clearError}
            aria-label="Закрыть ошибку"
          >
            ✕
          </button>
        </div>
      )}

      <div
        className={`${styles["app__sidebar"]} ${
          activeChatId ? styles["app__sidebar--hidden-mobile"] : ""
        }`}
      >
        <ChatList
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onCreateChat={handleCreateChat}
          onLogout={handleLogout}
        />
      </div>

      <div
        className={`${styles["app__chat-window"]} ${
          !activeChatId ? styles["app__chat-window--hidden-mobile"] : ""
        }`}
      >
        <ChatWindow
          chat={activeChat}
          messages={activeMessages}
          onSendMessage={handleSendMessage}
          onBack={() => handleSelectChat(null)}
        />
      </div>
    </div>
  );
};

export default App;
