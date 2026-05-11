import axios from 'axios'

import type { RemoteComboConfig } from '@/schemas/nodeDefSchema'

const BACKOFF_BASE_MS = 1000
const BACKOFF_CAP_MS = 16000

/**
 * Build a stable cache key for a remote combo configuration.
 *
 * All remote-combo routes go through comfy-api with auth, so the cache is
 * always partitioned by `authScope` — an opaque, non-secret identifier of
 * the active auth context (workspace id, firebase uid, etc.). Resolving the
 * scope is the caller's responsibility, which keeps this helper pure and
 * trivially testable.
 */
export function buildCacheKey(
  config: RemoteComboConfig,
  authScope: string | null | undefined
): string {
  const params = new URLSearchParams({
    route: config.route,
    responseKey: config.response_key ?? '',
    u: authScope ?? 'anon'
  })
  return `https://cache.comfy.invalid/?${params}`
}

/**
 * Exponential backoff in milliseconds, capped at 16s. `count` is the
 * number of failed attempts so far (1-indexed for the first retry).
 */
export function getBackoff(count: number): number {
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, count), BACKOFF_CAP_MS)
}

/**
 * Distinguish transient errors (worth retrying) from permanent ones.
 * 401/403/404 etc. won't fix themselves — retrying wastes time.
 * Network-level failures (no response) are treated as retriable.
 */
export function isRetriableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return true
  const status = err.response?.status
  if (status == null) return true
  if (status >= 500) return true
  return status === 408 || status === 429
}

/**
 * Build a console-safe summary of an unknown error. Authenticated remote
 * routes inject auth headers via fetchRemoteRoute, and AxiosError serializes
 * its `config` (including those headers) by default — so logging the raw
 * error would leak bearer tokens to devtools and any attached telemetry.
 * This summary keeps only the diagnostic essentials.
 */
export function summarizeError(err: unknown): Record<string, unknown> {
  if (axios.isAxiosError(err)) {
    return {
      message: err.message,
      code: err.code,
      status: err.response?.status
    }
  }
  if (err instanceof Error) {
    return { message: err.message, name: err.name }
  }
  return { message: String(err) }
}

const PAYLOAD_KEY_SAMPLE = 10

/**
 * Build a console-safe summary of a remote response payload. Logs the
 * structural shape so devs can diagnose schema mismatches without the
 * actual values, which for authenticated routes may contain private data.
 */
export function summarizePayload(data: unknown): Record<string, unknown> {
  if (data === null) return { type: 'null' }
  if (data === undefined) return { type: 'undefined' }
  if (Array.isArray(data)) return { type: 'array', length: data.length }
  if (typeof data === 'object') {
    const keys = Object.keys(data as Record<string, unknown>)
    return {
      type: 'object',
      keys: keys.slice(0, PAYLOAD_KEY_SAMPLE),
      keyCount: keys.length
    }
  }
  return { type: typeof data }
}
