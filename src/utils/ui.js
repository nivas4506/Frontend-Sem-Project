export function escapeHTML(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function mediaURL(value, fallback = '/src/assets/logo.png') {
  try {
    if (!value) return fallback;
    const url = new URL(value, location.href);
    if (['http:', 'https:'].includes(url.protocol)) return url.href;
    if (/^data:(image\/(png|jpeg|webp|gif)|audio\/[\w.+-]+);base64,/i.test(value)) return value;
  } catch { /* Use local image if invalid */ }
  return fallback;
}

export function readStored(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
