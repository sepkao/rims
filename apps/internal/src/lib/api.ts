export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

type ApiErrorBody = { error?: string; code?: string; [key: string]: unknown }

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details: ApiErrorBody

  constructor(message: string, status: number, details: ApiErrorBody = {}) {
    super(message)
    this.status = status
    this.code = details.code
    this.details = details
  }
}

// API_BASE_URL may be absolute (dev: http://localhost:3000) or a same-origin
// prefix like "/api" (production, proxied by vercel.json so the session cookie
// is first-party - WebKit drops cross-site cookies even with SameSite=None).
// Paths are joined rather than URL-resolved: resolving "/auth/login" against
// ".../api" would silently drop the "/api" prefix.
function resolveApiUrl(path: string): URL {
  const base = new URL(API_BASE_URL.replace(/\/?$/, '/'), window.location.origin)
  const url = new URL(path.replace(/^\/+/, ''), base)
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new Error('apiFetch: path must resolve inside the configured API base')
  }
  return url
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = resolveApiUrl(path)
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })
  const body = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status, body)
  return body
}
