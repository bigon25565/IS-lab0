/** Статус сообщения. Соответствует enum MessageStatus на диаграмме классов. */
export enum MessageStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
}

/** Условный id текущего пользователя. В реальном приложении берётся из токена. */
export const OWN_AUTHOR_ID = 'me';

export class User {
  constructor(
    public id: string,
    public name: string,
    public avatarUrl: string = '',
  ) {}
}

export class Dialog {
  constructor(
    public id: string,
    public title: string,
  ) {}
}

export class Message {
  clientId: string;
  id: string;
  text: string;
  authorId: string;
  createdAt: Date;
  status: MessageStatus;

  constructor(text: string, authorId: string, clientId: string = crypto.randomUUID()) {
    this.clientId = clientId;   // локальный ключ: нужен для статуса и повтора
    this.id = '';               // серверный id, приходит в подтверждении
    this.text = text;
    this.authorId = authorId;
    this.createdAt = new Date();
    this.status = MessageStatus.Pending;
  }
}