'use client';

/**
 * Shared API helper for SkillSetu.
 *
 * Why this exists: every protected endpoint in the FastAPI backend is guarded by
 * the `require_role(...)` dependency, which returns 401 when no Authorization
 * header is present. Before this module, only the admin analytics page sent a
 * bearer token, so the other pages received 401 JSON bodies, passed them into
 * `res.json()` without checking `res.ok`, and silently rendered their hardcoded
 * placeholder data instead. The UI looked healthy while showing nothing real.
 *
 * `apiFetch` attaches the stored access token to every request, so a signed-in
 * user actually reaches the protected endpoints.
 *
 * Requests use relative `/api/...` paths, which Next.js proxies to the backend
 * via the `rewrites()` rule in next.config.js. That keeps the browser on one
 * origin (no CORS preflight) and means the backend host is configured in one
 * place rather than hardcoded per call site.
 */

const TOKEN_STORAGE_KEY = 'skillsetu.access_token';

// Cached so we do not touch localStorage on every single request.
let inMemoryToken: string | null = null;

/**
 * Store the access token, or pass null to clear it.
 *
 * The token is persisted to localStorage so a page refresh does not silently
 * log the user out. localStorage access is wrapped because it throws in some
 * privacy modes; the in-memory copy still works for the rest of the session.
 */
export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable - continue with the in-memory token only.
  }
}

export function getAccessToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === 'undefined') return null;
  try {
    inMemoryToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    inMemoryToken = null;
  }
  return inMemoryToken;
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Error carrying the HTTP status and the backend's `detail` message. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * fetch() with the bearer token attached.
 *
 * A JSON Content-Type is set automatically for requests that carry a body,
 * except for FormData uploads, where the browser must set the multipart
 * boundary itself.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(path, { ...init, headers });
}

/**
 * apiFetch that returns parsed JSON and throws ApiError on a non-2xx response.
 *
 * Prefer this over apiFetch when a failed call should be handled explicitly,
 * so an error body can never be mistaken for real data.
 */
export async function apiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);

  if (!res.ok) {
    let detail: string = res.statusText || 'Request failed';
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      // Response had no JSON body; keep the status text.
    }
    throw new ApiError(res.status, detail);
  }

  return (await res.json()) as T;
}
