import { readFile } from 'node:fs/promises'

type FetchAttempt<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'err'; reason: string; retryable: boolean }

export type FetchResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'err'; reason: string }

interface RetryOptions<T> {
  retryDelaysMs: readonly number[]
  sleep?: (ms: number) => Promise<void>
  attempt: () => Promise<FetchAttempt<T>>
}

export async function fetchWithRetry<T>({
  retryDelaysMs,
  sleep = defaultSleep,
  attempt
}: RetryOptions<T>): Promise<FetchResult<T>> {
  let lastReason = 'unknown error'
  for (let index = 0; index <= retryDelaysMs.length; index++) {
    if (index > 0) await sleep(retryDelaysMs[index - 1])

    const result = await attempt()
    if (result.kind === 'ok') return result
    lastReason = result.reason
    if (!result.retryable) return { kind: 'err', reason: result.reason }
  }
  return { kind: 'err', reason: lastReason }
}

interface JsonRequestOptions {
  fetchImpl: typeof fetch
  url: string
  timeoutMs: number
  headers?: HeadersInit
}

export async function requestJson({
  fetchImpl,
  url,
  timeoutMs,
  headers = { Accept: 'application/json' }
}: JsonRequestOptions): Promise<FetchAttempt<unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })
    if (response.ok) return { kind: 'ok', value: await response.json() }
    return {
      kind: 'err',
      reason: `HTTP ${response.status} ${response.statusText || ''}`.trim(),
      retryable:
        response.status === 429 ||
        (response.status >= 500 && response.status < 600)
    }
  } catch (error) {
    return {
      kind: 'err',
      reason:
        error instanceof Error
          ? `network error: ${error.message}`
          : 'network error',
      retryable: true
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function readSnapshot<T>(
  snapshotUrl: URL | undefined,
  bundledSnapshot: unknown,
  isSnapshot: (value: unknown) => value is T
): Promise<T | null> {
  if (snapshotUrl) {
    try {
      const parsed: unknown = JSON.parse(await readFile(snapshotUrl, 'utf8'))
      if (isSnapshot(parsed)) return parsed
    } catch {
      // Fall through to the bundled snapshot if the override is unreadable.
    }
  }
  return isSnapshot(bundledSnapshot) ? bundledSnapshot : null
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
