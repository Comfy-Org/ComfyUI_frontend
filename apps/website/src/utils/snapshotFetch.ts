import { readFile } from 'node:fs/promises'

export type FetchErrorKind = 'network' | 'http' | 'json' | 'schema'

type FetchAttempt<T> =
  | { kind: 'ok'; value: T }
  | {
      kind: 'err'
      reason: string
      retryable: boolean
      errorKind: FetchErrorKind
    }

export type FetchResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'err'; reason: string; errorKind: FetchErrorKind }

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
  let lastErrorKind: FetchErrorKind = 'network'
  for (let index = 0; index <= retryDelaysMs.length; index++) {
    if (index > 0) await sleep(retryDelaysMs[index - 1])

    const result = await attempt()
    if (result.kind === 'ok') return result
    lastReason = result.reason
    lastErrorKind = result.errorKind
    if (!result.retryable) return result
  }
  return { kind: 'err', reason: lastReason, errorKind: lastErrorKind }
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
    if (response.ok) {
      try {
        return { kind: 'ok', value: await response.json() }
      } catch (error) {
        return {
          kind: 'err',
          reason: `JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
          retryable: false,
          errorKind: 'json'
        }
      }
    }
    await response.body?.cancel().catch(() => {})
    return {
      kind: 'err',
      reason: `HTTP ${response.status} ${response.statusText || ''}`.trim(),
      errorKind: 'http',
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
      retryable: true,
      errorKind: 'network'
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
