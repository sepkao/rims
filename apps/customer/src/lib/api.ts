function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    return envUrl
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3000`
  }
  return envUrl ?? (import.meta.env.DEV ? 'http://localhost:3000' : '')
}

export const API_BASE_URL = getApiBaseUrl()

type ApiErrorBody = { error?: string }

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function resolveApiUrl(path: string): URL {
  const base = new URL(API_BASE_URL)
  const url = new URL(path, base)
  if (url.origin !== base.origin) {
    throw new Error('apiFetch: path must resolve to the configured API origin')
  }
  return url
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = resolveApiUrl(path)
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })
  const body = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status)
  return body
}
