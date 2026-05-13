import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeatureFlagsSnapshot } from '../data/feature-flags'

import {
  fetchFeatureFlagsForBuild,
  resetFeatureFlagsFetcherForTests
} from './featureFlags'

const BASE_URL = 'https://api.test'
const tempSnapshotDirs: string[] = []

function response(body: unknown, init: Partial<ResponseInit> = {}): Response {
  const base: ResponseInit = {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }
  return new Response(JSON.stringify(body), { ...base, ...init })
}

function makeSnapshot(cloudFreeTier: boolean): FeatureFlagsSnapshot {
  return {
    fetchedAt: '2026-04-01T00:00:00.000Z',
    flags: { cloudFreeTier }
  }
}

function withSnapshotDir(snapshot: FeatureFlagsSnapshot | null): URL {
  const dir = mkdtempSync(join(tmpdir(), 'feature-flags-test-'))
  tempSnapshotDirs.push(dir)
  const file = join(dir, 'feature-flags.snapshot.json')
  if (snapshot) writeFileSync(file, JSON.stringify(snapshot))
  return pathToFileURL(file)
}

describe('fetchFeatureFlagsForBuild', () => {
  beforeEach(() => {
    resetFeatureFlagsFetcherForTests()
  })

  afterEach(() => {
    for (const dir of tempSnapshotDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
    vi.restoreAllMocks()
  })

  it('returns fresh with cloudFreeTier=true when /features sets the flag', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ new_free_tier_subscriptions: true })
    )
    const outcome = await fetchFeatureFlagsForBuild({
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.flags.cloudFreeTier).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/features`,
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('defaults cloudFreeTier to false when the flag is absent from /features', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ partner_node_conversion_rate: 0.05 })
    )
    const outcome = await fetchFeatureFlagsForBuild({
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.flags.cloudFreeTier).toBe(false)
  })

  it('returns fresh with cloudFreeTier=false when explicitly disabled', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ new_free_tier_subscriptions: false })
    )
    const outcome = await fetchFeatureFlagsForBuild({
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.flags.cloudFreeTier).toBe(false)
  })

  it('returns stale with snapshot when the API returns 401', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot(true))
    const fetchImpl = vi.fn(async () => response({}, { status: 401 }))
    const outcome = await fetchFeatureFlagsForBuild({
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^HTTP 401/)
    expect(outcome.snapshot.flags.cloudFreeTier).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries 5xx up to the configured limit then falls back to snapshot', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot(false))
    const fetchImpl = vi.fn(async () => response({}, { status: 503 }))
    const sleep = vi.fn(async () => undefined)
    const outcome = await fetchFeatureFlagsForBuild({
      baseUrl: BASE_URL,
      snapshotUrl,
      retryDelaysMs: [1, 1, 1],
      sleep,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('falls back to snapshot on schema validation failure', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot(false))
    const fetchImpl = vi.fn(async () =>
      response({ new_free_tier_subscriptions: 'yes' })
    )
    const outcome = await fetchFeatureFlagsForBuild({
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^schema validation/)
  })

  it('falls back to the bundled snapshot when fetch fails and the override is missing', async () => {
    const snapshotUrl = withSnapshotDir(null)
    const fetchImpl = vi.fn(async () => response({}, { status: 500 }))
    const sleep = vi.fn(async () => undefined)
    const outcome = await fetchFeatureFlagsForBuild({
      baseUrl: BASE_URL,
      snapshotUrl,
      retryDelaysMs: [1, 1, 1],
      sleep,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.snapshot.flags.cloudFreeTier).toBe(false)
  })

  it('memoizes within a single process', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ new_free_tier_subscriptions: true })
    )
    const opts = {
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    }
    const [a, b] = await Promise.all([
      fetchFeatureFlagsForBuild(opts),
      fetchFeatureFlagsForBuild(opts)
    ])
    expect(a).toBe(b)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('never writes to the snapshot file on success', async () => {
    const snapshot = makeSnapshot(true)
    const snapshotUrl = withSnapshotDir(snapshot)
    const fs = await import('node:fs')
    const initial = fs.readFileSync(snapshotUrl).toString()
    const fetchImpl = vi.fn(async () =>
      response({ new_free_tier_subscriptions: false })
    )
    await fetchFeatureFlagsForBuild({
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    const after = fs.readFileSync(snapshotUrl).toString()
    expect(after).toBe(initial)
  })
})
