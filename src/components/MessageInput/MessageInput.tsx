import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { MAX_MESSAGE_LENGTH } from "@/types";
import styles from "./MessageInput.module.css";

interface Props {
  onSendMessage: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Панель ввода сообщения с авторесайзом текстового поля и отправкой по Enter.
 */
export const MessageInput = ({
  onSendMessage,
  disabled = false,
  placeholder = "Написать сообщение...",
}: Props) => {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Автоматически адаптирует высоту поля под объем введенного текста (до 120px)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${nextHeight}px`;
  }, [text]);

  // Выполняет валидацию и передачу текста в родительский обработчик
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || disabled) return;

    try {
      setIsSending(true);
      await onSendMessage(trimmed);
      setText("");

      // Сбрасывает высоту и возвращает фокус после успешной отправки
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    } finally {
      setIsSending(false);
    }
  };

  // Обрабатывает отправку по Enter и перенос строки по Shift+Enter
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Пропускает событие при активном вводе через IME (символы восточноазиатских языков)
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Обновляет значение текста в локальном состоянии
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const canSubmit = text.trim().length > 0 && !isSending && !disabled;

  return (
    <form
      className={styles["message-input"]}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSend();
      }}
      aria-busy={isSending}
    >
      <div className={styles["message-input__controls"]}>
        <textarea
          ref={textareaRef}
          className={styles["message-input__textarea"]}
          rows={1}
          placeholder={placeholder}
          aria-label="Текст сообщения"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled || isSending}
        />

        <button
          type="submit"
          className={`${styles["message-input__send-button"]} ${
            canSubmit ? styles["message-input__send-button--active"] : ""
          }`}
          disabled={!canSubmit}
          aria-label="Отправить сообщение"
          title="Отправить (Enter)"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </form>
  );
};
