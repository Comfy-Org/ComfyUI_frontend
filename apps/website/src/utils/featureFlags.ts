import type { FeaturesResponse } from './featureFlags.schema'
import type { FeatureFlagsSnapshot } from '../data/feature-flags'

import { FeaturesResponseSchema } from './featureFlags.schema'

import bundledSnapshot from '../data/feature-flags.snapshot.json' with { type: 'json' }
import { fetchWithRetry, readSnapshot, requestJson } from './snapshotFetch'

const DEFAULT_BASE_URL = 'https://api.comfy.org'
const DEFAULT_TIMEOUT_MS = 10_000
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]

export type FetchOutcome =
  | { status: 'fresh'; snapshot: FeatureFlagsSnapshot }
  | { status: 'stale'; snapshot: FeatureFlagsSnapshot; reason: string }
  | { status: 'failed'; reason: string }

interface FetchFeatureFlagsOptions {
  baseUrl?: string
  timeoutMs?: number
  retryDelaysMs?: readonly number[]
  fetchImpl?: typeof fetch
  snapshotUrl?: URL
  sleep?: (ms: number) => Promise<void>
}

let inflight: Promise<FetchOutcome> | undefined

export function resetFeatureFlagsFetcherForTests(): void {
  inflight = undefined
}

export function fetchFeatureFlagsForBuild(
  options: FetchFeatureFlagsOptions = {}
): Promise<FetchOutcome> {
  inflight ??= doFetchFeatureFlagsForBuild(options)
  return inflight
}

async function doFetchFeatureFlagsForBuild(
  options: FetchFeatureFlagsOptions
): Promise<FetchOutcome> {
  const result = await tryFetchAndParse(options)
  if (result.kind === 'ok') {
    return {
      status: 'fresh',
      snapshot: {
        fetchedAt: new Date().toISOString(),
        flags: deriveFlags(result.features)
      }
    }
  }

  return fallback(result.reason, options.snapshotUrl)
}

async function fallback(
  reason: string,
  snapshotUrl: URL | undefined
): Promise<FetchOutcome> {
  const snapshot = await readSnapshot(
    snapshotUrl,
    bundledSnapshot,
    isFeatureFlagsSnapshot
  )
  if (snapshot) return { status: 'stale', snapshot, reason }
  return { status: 'failed', reason }
}

interface FetchOk {
  kind: 'ok'
  features: FeaturesResponse
}

interface FetchErr {
  kind: 'err'
  reason: string
}

async function tryFetchAndParse(
  options: FetchFeatureFlagsOptions
): Promise<FetchOk | FetchErr> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retryDelaysMs = options.retryDelaysMs ?? RETRY_DELAYS_MS
  const fetchImpl = options.fetchImpl ?? fetch
  const url = `${baseUrl.replace(/\/+$/, '')}/features`
  const result = await fetchWithRetry({
    retryDelaysMs,
    sleep: options.sleep,
    attempt: async () => {
      const response = await requestJson({ fetchImpl, url, timeoutMs })
      if (response.kind === 'err') return response

      const parsed = FeaturesResponseSchema.safeParse(response.value)
      if (parsed.success) {
        return { kind: 'ok' as const, value: parsed.data }
      }
      return {
        kind: 'err' as const,
        reason: `schema validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; ')}`,
        retryable: false
      }
    }
  })
  return result.kind === 'ok' ? { kind: 'ok', features: result.value } : result
}

function deriveFlags(
  features: FeaturesResponse
): FeatureFlagsSnapshot['flags'] {
  return {
    cloudFreeTier: features.new_free_tier_subscriptions ?? false
  }
}

function isFeatureFlagsSnapshot(value: unknown): value is FeatureFlagsSnapshot {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as { fetchedAt?: unknown; flags?: unknown }
  if (typeof candidate.fetchedAt !== 'string') return false
  if (candidate.flags === null || typeof candidate.flags !== 'object') {
    return false
  }
  const flags = candidate.flags as { cloudFreeTier?: unknown }
  return typeof flags.cloudFreeTier === 'boolean'
}
