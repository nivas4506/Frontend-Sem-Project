export function toast(message, type = 'info') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const item = document.createElement('div');
  item.className = `toast-item ${type}`;
  const text = document.createElement('span');
  text.textContent = message;
  const close = document.createElement('button');
  close.className = 'icon-button';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>`;
  close.addEventListener('click', () => item.remove());
  item.append(text, close);
  container.append(item);
  setTimeout(() => item.remove(), 4500);
}
