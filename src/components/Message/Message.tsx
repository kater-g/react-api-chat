import type { Message as MessageType } from "@/types";
import styles from "./Message.module.css";

interface Props {
  message: MessageType;
}

/**
 * Форматирует временную метку сообщения в локализованное время ЧЧ:ММ.
 */
const formatMessageTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/**
 * Элемент единичного сообщения (входящего или исходящего) со статусом доставки и временем.
 */
export const Message = ({ message }: Props) => {
  const { text, timestamp, isIncoming } = message;
  const date = new Date(timestamp);
  const time = formatMessageTime(timestamp);
  const status = message.status ?? "sent";

  const statusLabel =
    status === "read"
      ? "Прочитано"
      : status === "delivered"
        ? "Доставлено"
        : status === "failed" ||
            status === "noAccount" ||
            status === "notInGroup"
          ? "Не доставлено"
          : "Отправлено";

  const statusIcon =
    status === "read" || status === "delivered"
      ? "✓✓"
      : status === "failed" || status === "noAccount" || status === "notInGroup"
        ? "!"
        : "✓";

  return (
    <div
      className={`${styles.message} ${
        isIncoming ? styles["message--incoming"] : styles["message--outgoing"]
      }`}
    >
      <div
        className={`${styles["message__bubble"]} ${
          isIncoming
            ? styles["message__bubble--incoming"]
            : styles["message__bubble--outgoing"]
        }`}
      >
        <p className={styles["message__text"]}>{text}</p>
        <div className={styles["message__meta"]}>
          <time
            className={styles["message__time"]}
            dateTime={date.toISOString()}
          >
            {time}
          </time>
          {!isIncoming && (
            <span
              className={`${styles["message__status"]} ${
                status === "read" ? styles["message__status--read"] : ""
              } ${
                status === "failed" ||
                status === "noAccount" ||
                status === "notInGroup"
                  ? styles["message__status--failed"]
                  : ""
              }`}
              role="img"
              aria-label={statusLabel}
              title={statusLabel}
            >
              {statusIcon}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
