export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

type ApiErrorBody = { error?: string }

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  const body = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status)
  return body
}
