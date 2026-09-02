function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (import.meta.env.PROD && envUrl) {
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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    credentials: 'include',
  })
  const body = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status)
  return body
}
