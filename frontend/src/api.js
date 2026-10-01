// Адрес бэкенда: ?api=... в URL → сохранённый вручную → VITE_API_URL при сборке → тот же origin.
const STORAGE_KEY = 'test_app_api_url';

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function resolveApiUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get('api');
  if (fromQuery) {
    saveApiUrl(fromQuery);
    return { url: trim(fromQuery), source: 'параметр ?api= в адресе' };
  }
  const stored = readStored();
  if (stored) return { url: trim(stored), source: 'задан вручную на этой странице' };
  if (import.meta.env.VITE_API_URL) return { url: trim(import.meta.env.VITE_API_URL), source: 'VITE_API_URL при сборке' };
  return { url: '', source: 'тот же домен (VITE_API_URL не задан)' };
}

export function saveApiUrl(url) {
  try {
    if (url) localStorage.setItem(STORAGE_KEY, trim(url));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* приватный режим — просто не запоминаем */
  }
}

function trim(url) {
  return url.trim().replace(/\/+$/, '');
}

export async function request(baseUrl, path, options = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const latencyMs = Math.round(performance.now() - started);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
  return { body, latencyMs, headers: response.headers };
}
