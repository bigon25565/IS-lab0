import { ApiClient } from './api-client.js';
import { SocketClient } from './socket-client.js';
import { ChatView } from './chat-view.js';
import { Message, MessageStatus, OWN_AUTHOR_ID } from './models.js';

/** Логика чата: связывает представление, REST и WebSocket. */
export class ChatService {
  private messages: Message[] = [];
  private api!: ApiClient;      // создаются в init()
  private socket!: SocketClient;
  private view: ChatView;
  private notify: (name: string, data: unknown) => void;
  private currentUserId: string = OWN_AUTHOR_ID;

  constructor(view: ChatView, notify: (name: string, data: unknown) => void) {
    this.view = view;
    this.notify = notify;
  }

  async init(apiUrl: string, token: string): Promise<void> {
    this.api = new ApiClient(apiUrl, token);

    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';
    this.socket = new SocketClient(wsUrl);
    this.socket.onMessage((event) => this.handleServerEvent(event));
    this.socket.onStateChange((isOnline) => this.view.setConnectionState(isOnline));

    await this.loadHistory();
    this.socket.connect(token);
  }

  async loadHistory(): Promise<void> {
    this.messages = await this.api.getMessages();
    this.view.render(this.messages);
  }

  sendMessage(text: string): void {
    const message = new Message(text, this.currentUserId);
    this.messages.push(message);
    this.view.addMessage(message);
    void this.transmit(message);
  }

  onMessage(message: Message): void {
    this.messages.push(message);
    this.view.addMessage(message);
    this.notify('chat-message', { message });
  }

  onAck(clientId: string): void {
    const message = this.find(clientId);
    if (!message) return;

    message.status = MessageStatus.Sent;
    this.view.updateStatus(clientId, message.status);
    this.notify('chat-message-sent', { clientId });
  }

  retry(clientId: string): void {
    const message = this.find(clientId);
    if (!message) return;

    if (!this.socket.isConnected) {
      this.socket.reconnect();
    }
    void this.transmit(message);
  }

  destroy(): void {
    this.socket?.close();
  }

  /** Отправка: по WebSocket, при обрыве — резервно через REST. */
  private async transmit(message: Message): Promise<void> {
    message.status = MessageStatus.Pending;
    this.view.updateStatus(message.clientId, message.status);

    try {
      if (this.socket.isConnected) {
        this.socket.send(message);          // подтверждение придёт в onAck
      } else {
        const saved = await this.api.postMessage(message);
        message.id = saved.id;
        this.onAck(message.clientId);
      }
    } catch (error) {
      message.status = MessageStatus.Failed;
      this.view.updateStatus(message.clientId, message.status);
      this.notify('chat-error', {
        clientId: message.clientId,
        message: (error as Error).message,
      });
    }
  }

  private handleServerEvent(event: any): void {
    switch (event.type) {
      case 'message': {
        const incoming = new Message(event.text, event.authorId, event.clientId ?? event.id);
        incoming.id = event.id;
        incoming.createdAt = new Date(event.createdAt);
        incoming.status = MessageStatus.Sent;
        this.onMessage(incoming);
        break;
      }
      case 'ack': {
        const message = this.find(event.clientId);
        if (message) message.id = event.id;
        this.onAck(event.clientId);
        break;
      }
    }
  }

  private find(clientId: string): Message | undefined {
    return this.messages.find((m) => m.clientId === clientId);
  }
}