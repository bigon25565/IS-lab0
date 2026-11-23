import { Message, MessageStatus, OWN_AUTHOR_ID } from './models.js';

const STATUS_TEXT: Record<MessageStatus, string> = {
  [MessageStatus.Pending]: 'отправляется…',
  [MessageStatus.Sent]: 'отправлено ✓',
  [MessageStatus.Failed]: 'не отправлено',
};

const TEMPLATE = `
<style>
  :host {
    --chat-bg: #ffffff;
    --chat-accent: #2f6fed;
    --chat-text: #1c1c1c;
    --chat-border: #e3e3e3;
    display: block;
    font-family: Arial, sans-serif;
    color: var(--chat-text);
  }
  .widget { border: 1px solid var(--chat-border); border-radius: 8px; background: var(--chat-bg); }
  .banner { padding: 8px 12px; background: #ffe9e9; font-size: 13px; }
  .banner[hidden] { display: none; }
  .list { list-style: none; margin: 0; padding: 12px; height: 320px; overflow-y: auto; }
  .msg { margin-bottom: 10px; max-width: 80%; }
  .msg.own { margin-left: auto; text-align: right; }
  .text { padding: 8px 12px; border-radius: 10px; background: #f1f2f4; white-space: pre-wrap; }
  .msg.own .text { background: var(--chat-accent); color: #fff; }
  .meta { font-size: 11px; color: #8a8a8a; margin-top: 3px; }
  .meta > * { margin-left: 6px; }
  .retry { display: none; font-size: 11px; cursor: pointer; }
  .msg.failed .retry { display: inline; }
  .composer { display: flex; gap: 8px; padding: 10px; border-top: 1px solid var(--chat-border); }
  textarea { flex: 1; resize: none; height: 40px; font-family: inherit; }
  button.send { padding: 0 16px; background: var(--chat-accent); color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
  .hint { color: #c0392b; font-size: 12px; padding: 0 10px 8px; }
</style>
<div class="widget">
  <div class="banner" hidden>Нет соединения. Сообщения будут отправлены после восстановления связи.</div>
  <ul class="list"></ul>
  <div class="hint" hidden>Введите сообщение</div>
  <div class="composer">
    <textarea placeholder="Сообщение…"></textarea>
    <button class="send" type="button">Отправить</button>
  </div>
</div>
`;

/** Отрисовка интерфейса внутри Shadow DOM. */
export class ChatView {
  private root: ShadowRoot;
  private messageList: HTMLElement;
  private input: HTMLTextAreaElement;
  private banner: HTMLElement;
  private hint: HTMLElement;

  private sendHandler: (text: string) => void = () => {};
  private retryHandler: (clientId: string) => void = () => {};

  constructor(root: ShadowRoot) {
    this.root = root;
    this.root.innerHTML = TEMPLATE;

    this.messageList = this.root.querySelector('.list')!;
    this.input = this.root.querySelector('textarea')!;
    this.banner = this.root.querySelector('.banner')!;
    this.hint = this.root.querySelector('.hint')!;

    this.root.querySelector('.send')!.addEventListener('click', () => this.submit());

    this.input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.submit();
      }
    });

    // Делегирование: одна подписка на весь список сообщений
    this.messageList.addEventListener('click', (event: Event) => {
      const button = (event.target as HTMLElement).closest('.retry') as HTMLElement | null;
      if (button?.dataset.clientId) {
        this.retryHandler(button.dataset.clientId);
      }
    });
  }

  render(messages: Message[]): void {
    this.messageList.innerHTML = '';
    messages.forEach((message) => this.addMessage(message));
  }

  addMessage(message: Message): void {
    const item = document.createElement('li');
    item.className = 'msg' + (message.authorId === OWN_AUTHOR_ID ? ' own' : '');
    item.dataset.clientId = message.clientId;
    if (message.status === MessageStatus.Failed) item.classList.add('failed');

    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = message.text;   // textContent, а не innerHTML — защита от XSS

    const meta = document.createElement('div');
    meta.className = 'meta';

    const time = document.createElement('span');
    time.textContent = message.createdAt.toLocaleTimeString('ru-RU', {
      hour: '2-digit', minute: '2-digit',
    });

    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = STATUS_TEXT[message.status];

    const retry = document.createElement('button');
    retry.className = 'retry';
    retry.type = 'button';
    retry.textContent = 'Повторить';
    retry.dataset.clientId = message.clientId;

    meta.append(time, status, retry);
    item.append(text, meta);
    this.messageList.append(item);
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  updateStatus(clientId: string, status: MessageStatus): void {
    const item = this.messageList.querySelector<HTMLElement>(`[data-client-id="${clientId}"]`);
    if (!item) return;

    item.querySelector('.status')!.textContent = STATUS_TEXT[status];
    item.classList.toggle('failed', status === MessageStatus.Failed);
  }

  setConnectionState(isOnline: boolean): void {
    this.banner.hidden = isOnline;
  }

  onSendClick(handler: (text: string) => void): void {
    this.sendHandler = handler;
  }

  onRetryClick(handler: (clientId: string) => void): void {
    this.retryHandler = handler;
  }

  destroy(): void {
    this.root.innerHTML = '';
  }

  private submit(): void {
    const text = this.input.value.trim();
    if (!text) {
      this.hint.hidden = false;
      return;
    }
    this.hint.hidden = true;
    this.input.value = '';
    this.sendHandler(text);
  }
}