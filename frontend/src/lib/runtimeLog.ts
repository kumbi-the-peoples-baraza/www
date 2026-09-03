export type RuntimeError = {
  id: string
  message: string
  context?: Record<string, unknown>
  level: 'error' | 'warning' | 'info'
  timestamp: string
}

const KEY = 'kumbi_runtime_errors'
const MAX = 100

function readAll(): RuntimeError[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as RuntimeError[]
  } catch {
    return []
  }
}

function writeAll(list: RuntimeError[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  } catch {}
}

export function logRuntimeError(message: string, context?: Record<string, unknown>, level: RuntimeError['level'] = 'error') {
  const entry: RuntimeError = {
    id: Math.random().toString(36).slice(2, 9),
    message,
    context,
    level,
    timestamp: new Date().toISOString(),
  }
  const all = readAll()
  all.push(entry)
  writeAll(all)
  // also console for dev
  // eslint-disable-next-line no-console
  console.error(`[runtime] ${message}`, context)
  // fire-and-forget to backend if available (best effort)
  try {
    const url = (import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || ''
    // use fetch to avoid circular import with api client
    fetch(`${url}/api/v1/runtime-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      credentials: 'include',
    }).catch(() => {})
  } catch {}
}

export function getRuntimeErrors(): RuntimeError[] {
  return readAll().slice().reverse()
}

export function clearRuntimeErrors() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
