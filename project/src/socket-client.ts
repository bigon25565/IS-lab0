import { Message } from './models.js';

type MessageHandler = (event: any) => void;
type StateHandler = (isOnline: boolean) => void;

/** WebSocket-клиент с автоматическим переподключением. */
export class SocketClient {
  private socket: WebSocket | null = null;
  private attempts: number = 0;

  private url: string;
  private token: string = '';
  private timerId: number = 0;
  private closedByUser: boolean = false;
  private readonly maxAttempts: number = 5;

  private messageHandler: MessageHandler = () => {};
  private stateHandler: StateHandler = () => {};

  isConnected: boolean = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(token: string): void {
    this.token = token;
    this.closedByUser = false;

    this.socket = new WebSocket(`${this.url}?token=${encodeURIComponent(token)}`);

    this.socket.onopen = () => {
      this.attempts = 0;
      this.isConnected = true;
      this.stateHandler(true);
    };

    this.socket.onmessage = (event: MessageEvent) => {
      this.messageHandler(JSON.parse(event.data));
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.stateHandler(false);
      if (!this.closedByUser) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => this.socket?.close();

    window.addEventListener('online', this.onNetworkOnline);
  }

  send(message: Message): void {
    if (!this.isConnected || !this.socket) {
      throw new Error('Соединение не установлено');
    }
    this.socket.send(JSON.stringify({
      type: 'message',
      clientId: message.clientId,
      text: message.text,
    }));
  }

  /** Ручное переподключение: сбрасывает счётчик попыток. */
  reconnect(): void {
    this.attempts = 0;
    window.clearTimeout(this.timerId);
    this.connect(this.token);
  }

  close(): void {
    this.closedByUser = true;
    window.clearTimeout(this.timerId);
    window.removeEventListener('online', this.onNetworkOnline);
    this.socket?.close();
    this.socket = null;
    this.isConnected = false;
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onStateChange(handler: StateHandler): void {
    this.stateHandler = handler;
  }

  /** Пауза растёт: 1 с, 2 с, 4 с, 8 с, 16 с. */
  private scheduleReconnect(): void {
    if (this.attempts >= this.maxAttempts) {
      return;
    }
    const delay = Math.min(1000 * 2 ** this.attempts, 30000);
    this.attempts += 1;
    this.timerId = window.setTimeout(() => this.connect(this.token), delay);
  }

  private onNetworkOnline = (): void => this.reconnect();
}