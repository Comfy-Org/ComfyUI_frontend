import type { Page, Request, Response } from '@playwright/test'

const APP_CHUNK_RESOURCE_TYPES = new Set(['script', 'stylesheet'])

const I18N_404_IN_EVERY_CLOUD_ENVIRONMENT =
  /^Failed to load resource: the server responded with a status of 404 \([^)]*\) \[https:\/\/[^\s\]]+\/api\/i18n(?:[?#][^\s\]]*)?\]$/

/** True only for the `/api/i18n` 404 console line that every Cloud environment logs at boot. */
export function isBootConsoleErrorInEveryCloudEnvironment(
  error: string
): boolean {
  return I18N_404_IN_EVERY_CLOUD_ENVIRONMENT.test(error)
}

/** Records failed same-origin JS/CSS requests, one line per URL, and counts those still in flight. */
export function collectAppChunkFailures(
  page: Page,
  deploymentOrigin: string
): {
  readonly failures: string[]
  readonly pendingCount: number
  stop: () => void
  [Symbol.dispose]: () => void
} {
  const failures = new Map<string, string>()
  const pending = new Set<Request>()
  const isAppChunk = (request: Request) =>
    APP_CHUNK_RESOURCE_TYPES.has(request.resourceType()) &&
    new URL(request.url()).origin === deploymentOrigin
  const recordFirstFailure = (url: string, detail: string) => {
    if (!failures.has(url)) failures.set(url, detail)
  }

  const onRequest = (request: Request) => {
    if (isAppChunk(request)) pending.add(request)
  }
  const onResponse = (response: Response) => {
    if (response.status() >= 400 && isAppChunk(response.request()))
      recordFirstFailure(
        response.url(),
        `HTTP ${response.status()} ${response.url()}`
      )
  }
  const onRequestFinished = (request: Request) => {
    pending.delete(request)
  }
  const onRequestFailed = (request: Request) => {
    pending.delete(request)
    if (!isAppChunk(request)) return
    recordFirstFailure(
      request.url(),
      `${request.failure()?.errorText ?? 'unknown'} ${request.url()}`
    )
  }

  page.on('request', onRequest)
  page.on('response', onResponse)
  page.on('requestfinished', onRequestFinished)
  page.on('requestfailed', onRequestFailed)
  const stop = () => {
    page.off('request', onRequest)
    page.off('response', onResponse)
    page.off('requestfinished', onRequestFinished)
    page.off('requestfailed', onRequestFailed)
  }
  return {
    get failures() {
      return [...failures.values()]
    },
    get pendingCount() {
      return pending.size
    },
    stop,
    [Symbol.dispose]: stop
  }
}
