import { Dialog, Message, MessageStatus } from './models.js';

/** REST-клиент: история сообщений и резервная отправка при обрыве WebSocket. */
export class ApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  async getDialog(): Promise<Dialog> {
    const dto = await this.request('/dialog');
    return new Dialog(dto.id, dto.title);
  }

  async getMessages(): Promise<Message[]> {
    const list = await this.request('/messages');
    return list.map((dto: any) => this.toMessage(dto));
  }

  async postMessage(message: Message): Promise<Message> {
    const dto = await this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ clientId: message.clientId, text: message.text }),
    });
    return this.toMessage(dto);
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(this.baseUrl + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: HTTP ${response.status}`);
    }
    return response.json();
  }

  private toMessage(dto: any): Message {
    const message = new Message(dto.text, dto.authorId, dto.clientId ?? dto.id);
    message.id = dto.id;
    message.createdAt = new Date(dto.createdAt);
    message.status = MessageStatus.Sent;
    return message;
  }
}