// Native WebSocket client. The optional Node gateway uses the same event protocol.
export class SocketService {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.connected = false;
    this.activeUsers = [];
    this.socket = null;
    this.session = null;
    this.retryTimer = null;
    this.attempt = 0;
  }

  start(session) {
    this.stop();
    this.session = session;
    this.connect();
  }

  connect() {
    if (!this.session) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.hostname || 'localhost'}:4001`;
    let socket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.socket !== socket || !this.session) return;
      socket.send(JSON.stringify({ type: 'auth', token: this.session.jwt?.accessToken, user: this.session.user }));
    });
    socket.addEventListener('message', event => {
      if (this.socket !== socket || !this.session) return;
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'auth:success') {
        this.connected = true;
        this.attempt = 0;
      }
      if (Array.isArray(data.activeUsers)) this.activeUsers = data.activeUsers;
      this.onEvent(data);
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.connected = false;
      this.activeUsers = [];
      this.onEvent({ type: 'connection:closed' });
      this.scheduleRetry();
    });
    // Close events handle retry and offline UI; errors should not interrupt the app.
    socket.addEventListener('error', () => {});
  }

  scheduleRetry() {
    if (!this.session) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), Math.min(30000, 2000 * 2 ** this.attempt++));
  }

  send(type, payload = {}) {
    if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  stop() {
    this.session = null;
    clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    this.activeUsers = [];
    this.attempt = 0;
    socket?.close();
  }
}
