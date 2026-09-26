import { useEffect, useRef } from "react";
import type { Chat, Message as MessageType } from "@/types";
import { Message, MessageInput } from "@/components";
import styles from "./ChatWindow.module.css";

interface Props {
  chat: Chat | null;
  messages: MessageType[];
  onSendMessage: (text: string) => Promise<void> | void;
  onBack?: () => void;
  isSending?: boolean;
}

/**
 * Извлекает первую цифру или букву для отрисовки аватарки собеседника.
 */
const getAvatarLetter = (nameOrId: string): string => {
  const digits = nameOrId.replace(/\D/g, "");
  return digits[0] || nameOrId[0] || "#";
};

/**
 * Окно активного чата с заголовком собеседника, лентой сообщений и полем ввода.
 */
export const ChatWindow = ({
  chat,
  messages,
  onSendMessage,
  onBack,
  isSending = false,
}: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Выполняет плавную прокрутку ленты вниз при добавлении сообщений или смене чата
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chat?.id]);

  // Отрисовывает заглушку, если диалог еще не выбран пользователем
  if (!chat) {
    return (
      <section
        className={`${styles["chat-window"]} ${styles["chat-window--empty"]}`}
        aria-label="Окно диалога"
      >
        <div className={styles["chat-window__placeholder"]}>
          <h2 className={styles["chat-window__placeholder-title"]}>
            Выберите чат
          </h2>
          <p className={styles["chat-window__placeholder-text"]}>
            Выберите диалог из списка слева или введите номер в поиске, чтобы
            начать общение.
          </p>
        </div>
      </section>
    );
  }

  const displayName = chat.name.replace(/@c\.us$/, "");
  const avatarLetter = getAvatarLetter(displayName).toUpperCase();

  return (
    <section
      className={styles["chat-window"]}
      aria-label={`Чат с ${displayName}`}
    >
      <header className={styles["chat-window__header"]}>
        {onBack && (
          <button
            type="button"
            className={styles["chat-window__back-button"]}
            onClick={onBack}
            aria-label="Вернуться к списку чатов"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
        )}

        <div className={styles["chat-window__avatar"]} aria-hidden="true">
          {avatarLetter}
        </div>

        <div className={styles["chat-window__user-info"]}>
          <h2 className={styles["chat-window__user-name"]}>{displayName}</h2>
          <span className={styles["chat-window__user-status"]}>WhatsApp</span>
        </div>
      </header>

      <main
        className={styles["chat-window__messages"]}
        role="log"
        aria-live="polite"
        aria-label="История сообщений"
      >
        {messages.length === 0 ? (
          <div className={styles["chat-window__empty-history"]}>
            <p>Нет сообщений. Напишите первое сообщение собеседнику!</p>
          </div>
        ) : (
          messages.map((message) => (
            <Message key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </main>

      <footer className={styles["chat-window__footer"]}>
        <MessageInput
          onSendMessage={onSendMessage}
          disabled={isSending}
          placeholder="Написать сообщение..."
        />
      </footer>
    </section>
  );
};
