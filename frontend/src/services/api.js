import axios from 'axios';

const SESSION_KEY = 'venex-session';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api', withCredentials: true, timeout: 15000 });

function sessionId() {
  let value = localStorage.getItem(SESSION_KEY);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function readCookie(name) {
  return document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.split('=').slice(1).join('=');
}

api.interceptors.request.use((config) => {
  config.headers['x-session-id'] = sessionId();
  const csrf = readCookie('venex_csrf');
  if (csrf && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) config.headers['x-csrf-token'] = decodeURIComponent(csrf);
  return config;
});

export const unwrap = (promise) => promise.then(({ data }) => data.data);
export const errorMessage = (error) => error?.response?.data?.error?.message || 'We could not complete that request. Please try again.';
export default api;

