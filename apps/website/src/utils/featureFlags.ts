import { readFile } from 'node:fs/promises'

import type { FeaturesResponse } from './featureFlags.schema'
import type { FeatureFlagsSnapshot } from '../data/feature-flags'

import { FeaturesResponseSchema } from './featureFlags.schema'

import bundledSnapshot from '../data/feature-flags.snapshot.json' with { type: 'json' }

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
  const snapshot = await readSnapshot(snapshotUrl)
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
  const sleep = options.sleep ?? defaultSleep

  const url = `${baseUrl.replace(/\/+$/, '')}/features`

  let lastReason = 'unknown error'
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) await sleep(retryDelaysMs[attempt - 1])

    const response = await callOnce(fetchImpl, url, timeoutMs)
    if (response.kind === 'err') {
      lastReason = response.reason
      if (!response.retryable) return response
      continue
    }

    const parsed = FeaturesResponseSchema.safeParse(response.body)
    if (!parsed.success) {
      return {
        kind: 'err',
        reason: `schema validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; ')}`
      }
    }

    return { kind: 'ok', features: parsed.data }
  }

  return { kind: 'err', reason: lastReason }
}

type CallResponse =
  | { kind: 'ok'; body: unknown }
  | { kind: 'err'; reason: string; retryable: boolean }

async function callOnce(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number
): Promise<CallResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    if (res.ok) {
      return { kind: 'ok', body: await res.json() }
    }
    const retryable =
      res.status === 429 || (res.status >= 500 && res.status < 600)
    return {
      kind: 'err',
      reason: `HTTP ${res.status} ${res.statusText || ''}`.trim(),
      retryable
    }
  } catch (error) {
    const reason =
      error instanceof Error
        ? `network error: ${error.message}`
        : 'network error'
    return { kind: 'err', reason, retryable: true }
  } finally {
    clearTimeout(timer)
  }
}

function deriveFlags(
  features: FeaturesResponse
): FeatureFlagsSnapshot['flags'] {
  return {
    cloudFreeTier: features.new_free_tier_subscriptions ?? false
  }
}

async function readSnapshot(
  snapshotUrl: URL | undefined
): Promise<FeatureFlagsSnapshot | null> {
  if (snapshotUrl) {
    try {
      const text = await readFile(snapshotUrl, 'utf8')
      const parsed: unknown = JSON.parse(text)
      if (isFeatureFlagsSnapshot(parsed)) return parsed
    } catch {
      // Fall through to the bundled snapshot if the override is unreadable.
    }
  }
  return isFeatureFlagsSnapshot(bundledSnapshot) ? bundledSnapshot : null
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

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
