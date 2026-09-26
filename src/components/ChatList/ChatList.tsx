import {
  useState,
  useMemo,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { Chat } from "@/types";
import styles from "./ChatList.module.css";

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: (phone: string) => void;
  onLogout?: () => void;
}

/**
 * Форматирует временную метку сообщения для отображения в списке диалогов (время или дата).
 */
const formatChatTime = (timestamp?: number): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();

  // Если сообщение отправлено сегодня — выводит время ЧЧ:ММ
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Если в другой день — выводит дату в коротком формате (например, "25 сент")
  return date
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    .replace(".", "");
};

/**
 * Вычисляет постоянный градиент для аватарки на основе хеша идентификатора чата.
 */
const getAvatarGradient = (id: string): string => {
  const gradients = [
    "linear-gradient(135deg, #007aff 0%, #00c6ff 100%)", // сине-голубой
    "linear-gradient(135deg, #ff9500 0%, #ff5e3a 100%)", // оранжевый
    "linear-gradient(135deg, #34c759 0%, #30d158 100%)", // зеленый
    "linear-gradient(135deg, #af52de 0%, #5856d6 100%)", // фиолетовый
    "linear-gradient(135deg, #ff2d55 0%, #ff375f 100%)", // малиновый
  ];

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

/**
 * Боковая панель со списком диалогов, поиском и созданием нового чата по номеру.
 */
export const ChatList = ({
  chats,
  activeChatId,
  onSelectChat,
  onCreateChat,
  onLogout,
}: Props) => {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Фильтрует диалоги по имени, сырому идентификатору и вхождению цифр
  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, "");

    return chats.filter((chat) => {
      if (!query) return true;

      const nameMatch = chat.name.toLowerCase().includes(query);
      const idMatch = chat.id.toLowerCase().includes(query);
      const digitsMatch = queryDigits
        ? chat.id.replace(/\D/g, "").includes(queryDigits)
        : false;
      return nameMatch || idMatch || digitsMatch;
    });
  }, [chats, searchQuery]);

  // Проверяет, является ли поисковый запрос новым телефонным номером для создания чата
  const potentialNewPhone = useMemo(() => {
    const raw = searchQuery.trim();
    const digits = raw.replace(/\D/g, "");

    if (digits.length < 10) return null;

    // Нормализует российский номер с 8 в начале к формату с 7
    let cleanPhone = digits;
    if (cleanPhone.length === 11 && cleanPhone.startsWith("8")) {
      cleanPhone = `7${cleanPhone.slice(1)}`;
    }

    // Исключает создание дубликата, если чат с таким номером уже присутствует в списке
    const alreadyExists = chats.some((c) => {
      const cDigits = c.id.replace(/\D/g, "");
      return cDigits === cleanPhone || c.id === cleanPhone;
    });

    if (alreadyExists) return null;

    return cleanPhone;
  }, [searchQuery, chats]);

  // Создает новый чат и очищает поисковую строку
  const handleCreateNewChat = (phone: string) => {
    onCreateChat(phone);
    setSearchQuery("");
  };

  // Обрабатывает отправку формы поиска по клавише Enter
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && potentialNewPhone) {
      e.preventDefault();
      handleCreateNewChat(potentialNewPhone);
    }
  };

  // Переводит фокус в строку ввода номера по клику на кнопку с плюсом
  const handlePlusClick = () => {
    searchInputRef.current?.focus();
  };

  return (
    <aside className={styles["chat-list"]} aria-label="Список чатов">
      <header className={styles["chat-list__header"]}>
        <h1 className={styles["chat-list__title"]}>Чаты</h1>
        <div className={styles["chat-list__header-actions"]}>
          <button
            type="button"
            className={styles["chat-list__create-button"]}
            onClick={handlePlusClick}
            title="Новый чат (поиск по номеру)"
            aria-label="Создать новый чат"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      <div className={styles["chat-list__search"]}>
        <div className={styles["chat-list__search-box"]}>
          <span className={styles["chat-list__search-icon"]} aria-hidden="true">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="text"
            className={styles["chat-list__search-input"]}
            placeholder="Найти или ввести номер"
            aria-label="Найти чат или ввести номер телефона"
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
            onKeyDown={handleKeyDown}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles["chat-list__clear-button"]}
              onClick={() => setSearchQuery("")}
              aria-label="Очистить поиск"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <ul className={styles["chat-list__items"]} aria-label="Диалоги">
        {potentialNewPhone && (
          <li className={styles["chat-list__entry"]}>
            <button
              type="button"
              className={styles["chat-list__new-chat-prompt"]}
              onClick={() => handleCreateNewChat(potentialNewPhone)}
            >
              <span
                className={styles["chat-list__new-chat-icon"]}
                aria-hidden="true"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  focusable="false"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </span>
              <span className={styles["chat-list__new-chat-info"]}>
                <span className={styles["chat-list__new-chat-title"]}>
                  Начать чат с +{potentialNewPhone}
                </span>
                <span className={styles["chat-list__new-chat-sub"]}>
                  Нажмите Enter или выберите этот пункт
                </span>
              </span>
            </button>
          </li>
        )}

        {filteredChats.map((chat) => {
          const isActive = chat.id === activeChatId;
          const initialLetter =
            (chat.name || chat.id).replace(/\D/g, "")[0] || chat.name[0] || "#";
          const formattedTime = formatChatTime(chat.lastMessage?.timestamp);

          return (
            <li className={styles["chat-list__entry"]} key={chat.id}>
              <button
                type="button"
                className={`${styles["chat-list__chat-item"]} ${
                  isActive ? styles["chat-list__chat-item--active"] : ""
                }`}
                onClick={() => onSelectChat(chat.id)}
                aria-current={isActive ? "true" : undefined}
              >
                <span
                  className={styles["chat-list__avatar"]}
                  style={{ background: getAvatarGradient(chat.id) }}
                  aria-hidden="true"
                >
                  {initialLetter.toUpperCase()}
                </span>

                <span className={styles["chat-list__chat-details"]}>
                  <span className={styles["chat-list__top-row"]}>
                    <span className={styles["chat-list__chat-name"]}>
                      {chat.name.replace(/@c\.us$/, "")}
                    </span>
                    {formattedTime && (
                      <span className={styles["chat-list__chat-time"]}>
                        {formattedTime}
                      </span>
                    )}
                  </span>
                  <span className={styles["chat-list__bottom-row"]}>
                    <span className={styles["chat-list__last-message"]}>
                      {chat.lastMessage
                        ? chat.lastMessage.text
                        : "Нет сообщений"}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}

        {filteredChats.length === 0 && !potentialNewPhone && (
          <li className={styles["chat-list__entry"]}>
            <p className={styles["chat-list__empty-state"]} role="status">
              {searchQuery ? "Ничего не найдено" : "Нет активных чатов"}
            </p>
          </li>
        )}
      </ul>

      {onLogout && (
        <footer className={styles["chat-list__footer"]}>
          <button
            type="button"
            className={styles["chat-list__logout-button"]}
            onClick={onLogout}
          >
            <span>Выход</span>
          </button>
        </footer>
      )}
    </aside>
  );
};
