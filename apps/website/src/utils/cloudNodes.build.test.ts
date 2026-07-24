import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FetchOutcome } from './cloudNodes'
import type { NodesSnapshot } from '../data/cloudNodes'

const fetchCloudNodesMock = vi.hoisted(() =>
  vi.fn<() => Promise<FetchOutcome>>()
)
const reportCloudNodesOutcomeMock = vi.hoisted(() => vi.fn())

vi.mock('./cloudNodes', () => ({
  fetchCloudNodesForBuild: fetchCloudNodesMock
}))

vi.mock('./cloudNodes.ci', () => ({
  reportCloudNodesOutcome: reportCloudNodesOutcomeMock
}))

import { loadPacksForBuild } from './cloudNodes.build'

const SNAPSHOT: NodesSnapshot = {
  fetchedAt: '2026-04-01T00:00:00.000Z',
  packs: [
    {
      id: 'snapshot-pack',
      displayName: 'Snapshot Pack',
      nodes: [
        { name: 'SnapshotNode', displayName: 'Snapshot Node', category: 'x' }
      ]
    }
  ]
}

describe('loadPacksForBuild', () => {
  const savedVercelEnv = process.env.VERCEL_ENV

  beforeEach(() => {
    fetchCloudNodesMock.mockReset()
    reportCloudNodesOutcomeMock.mockReset()
    delete process.env.VERCEL_ENV
  })

  afterEach(() => {
    if (savedVercelEnv === undefined) {
      delete process.env.VERCEL_ENV
      return
    }
    process.env.VERCEL_ENV = savedVercelEnv
  })

  it('returns packs when fetch is fresh', async () => {
    fetchCloudNodesMock.mockResolvedValue({
      status: 'fresh',
      snapshot: SNAPSHOT,
      droppedCount: 0,
      droppedNodes: []
    })

    const packs = await loadPacksForBuild()
    expect(packs).toBe(SNAPSHOT.packs)
    expect(reportCloudNodesOutcomeMock).toHaveBeenCalledTimes(1)
  })

  it('returns snapshot packs when outcome is stale outside production', async () => {
    fetchCloudNodesMock.mockResolvedValue({
      status: 'stale',
      snapshot: SNAPSHOT,
      reason: 'missing WEBSITE_CLOUD_API_KEY'
    })

    const packs = await loadPacksForBuild()
    expect(packs).toBe(SNAPSHOT.packs)
    expect(reportCloudNodesOutcomeMock).toHaveBeenCalledTimes(1)
  })

  it('returns snapshot packs when outcome is stale on Vercel preview', async () => {
    process.env.VERCEL_ENV = 'preview'
    fetchCloudNodesMock.mockResolvedValue({
      status: 'stale',
      snapshot: SNAPSHOT,
      reason: 'HTTP 503'
    })

    const packs = await loadPacksForBuild()
    expect(packs).toBe(SNAPSHOT.packs)
    expect(reportCloudNodesOutcomeMock).toHaveBeenCalledTimes(1)
  })

  it('throws when outcome is stale on Vercel production', async () => {
    process.env.VERCEL_ENV = 'production'
    fetchCloudNodesMock.mockResolvedValue({
      status: 'stale',
      snapshot: SNAPSHOT,
      reason: 'missing WEBSITE_CLOUD_API_KEY'
    })

    await expect(loadPacksForBuild()).rejects.toThrow(
      /stale data in a production build/
    )
    await expect(loadPacksForBuild()).rejects.toThrow(
      /missing WEBSITE_CLOUD_API_KEY/
    )
  })

  it('throws when outcome is failed regardless of environment', async () => {
    fetchCloudNodesMock.mockResolvedValue({
      status: 'failed',
      reason: 'network error: ECONNREFUSED'
    })

    await expect(loadPacksForBuild()).rejects.toThrow(
      /Cloud nodes fetch failed and no snapshot is available/
    )
    await expect(loadPacksForBuild()).rejects.toThrow(/ECONNREFUSED/)
  })

  it('still reports outcome before throwing on stale-in-production', async () => {
    process.env.VERCEL_ENV = 'production'
    fetchCloudNodesMock.mockResolvedValue({
      status: 'stale',
      snapshot: SNAPSHOT,
      reason: 'HTTP 503'
    })

    await expect(loadPacksForBuild()).rejects.toThrow()
    expect(reportCloudNodesOutcomeMock).toHaveBeenCalledTimes(1)
  })
})
