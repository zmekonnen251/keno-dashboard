// Environment access for the dashboard. Kept in one place so the rest of the app
// never touches process.env directly (important: only server components / route
// handlers may read non-NEXT_PUBLIC_ vars).

export function apiBase(): string {
  const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  return (base || 'http://127.0.0.1:5000').replace(/\/+$/, '');
}

// Name of the cookie the dashboard stores (HttpOnly, on the dashboard origin) that
// holds the upstream keno-server admin cookie value.
export const AUTH_COOKIE = 'ks_admin';
