import { ChatView } from './chat-view.js';
import { ChatService } from './chat-service.js';

/**
 * Встраиваемый веб-компонент мессенджера.
 * Настройка — атрибуты, управление — методы, связь с хостом — CustomEvent.
 */
export class ChatWidget extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['api-url', 'token', 'theme'];
  }

  private shadow: ShadowRoot;
  private view!: ChatView;
  private service!: ChatService;
  private started: boolean = false;

  apiUrl: string = '';
  token: string = '';
  theme: string = 'light';

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    if (this.started) return;

    this.apiUrl = this.getAttribute('api-url') ?? '';
    this.token = this.getAttribute('token') ?? '';
    this.theme = this.getAttribute('theme') ?? 'light';

    if (!this.apiUrl || !this.token) {
      this.emit('chat-error', { message: 'Не заданы атрибуты api-url или token' });
      return;
    }

    this.view = new ChatView(this.shadow);
    this.service = new ChatService(this.view, (name, data) => this.emit(name, data));
    this.view.onSendClick((text) => this.sendMessage(text));
    this.view.onRetryClick((clientId) => this.service.retry(clientId));
    this.started = true;

    this.service.init(this.apiUrl, this.token)
      .then(() => this.emit('chat-ready', {}))
      .catch((error: Error) => this.emit('chat-error', { message: error.message }));
  }

  disconnectedCallback(): void {
    this.service?.destroy();
    this.view?.destroy();
    this.started = false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value || !this.started) return;

    if (name === 'theme') {
      this.theme = value ?? 'light';
      return;
    }
    // Смена api-url или token — переинициализация
    this.disconnectedCallback();
    this.connectedCallback();
  }

  sendMessage(text: string): void {
    this.service?.sendMessage(text);
  }

  emit(name: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(name, {
      detail: data,
      bubbles: true,
      composed: true,   // событие выходит за границу Shadow DOM
    }));
  }
}

customElements.define('chat-widget', ChatWidget);