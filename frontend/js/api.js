import { CONFIG } from './config.js';

async function request(path, options = {}) {
  const response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error (${response.status})`);
  }

  return response.json();
}

export const api = {
  health: () => request('/api/health'),
  version: () => request('/api/version'),
};
