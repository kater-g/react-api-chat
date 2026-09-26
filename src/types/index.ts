export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
}

export interface SendMessageParams {
  chatId: string;
  message: string;
  typingTime?: number;
  quotedMessageId?: string;
}

export type MessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "suspended"
  | "noAccount"
  | "notInGroup"
  | "yellowCard";

export interface IncomingNotification {
  receiptId: number;
  body: {
    typeWebhook: string;
    timestamp?: number;
    idMessage?: string;
    chatId?: string;
    status?: MessageStatus;
    description?: string;
    senderData?: {
      chatId?: string;
      chatName?: string;
      sender?: string;
      senderName?: string;
      senderPhoneNumber?: number;
    };
    messageData?: {
      typeMessage?: string;
      textMessageData?: {
        textMessage?: string;
      };
      extendedTextMessageData?: {
        text?: string;
      };
    };
  };
}

export interface Message {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: number;
  isIncoming: boolean;
  status?: MessageStatus;
}

export interface Chat {
  id: string;
  name: string;
  lastMessage?: Message;
}

export const MAX_MESSAGE_LENGTH = 4000;
export const MIN_TYPING_TIME = 1000;
export const MAX_TYPING_TIME = 20000;
