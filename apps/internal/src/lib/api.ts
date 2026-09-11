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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  const body = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status, body)
  return body
}
