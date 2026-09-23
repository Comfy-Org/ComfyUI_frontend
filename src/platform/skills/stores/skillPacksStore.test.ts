import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listSkillPacks, SkillPacksApiError } from '../api/skillsApi'
import type { SkillPack } from '../types'
import { useSkillPacksStore } from './skillPacksStore'

const mocks = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  onFeatureFlags: vi.fn(),
  reportError: vi.fn()
}))

vi.mock<unknown>(import('posthog-js'), () => ({
  default: {
    isFeatureEnabled: mocks.isFeatureEnabled,
    onFeatureFlags: mocks.onFeatureFlags
  }
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))

vi.mock('../api/skillsApi', () => ({
  listSkillPacks: vi.fn(),
  SkillPacksApiError: class SkillPacksApiError extends Error {
    constructor(
      message: string,
      public readonly status: number
    ) {
      super(message)
    }
  }
}))

function makePack(overrides: Partial<SkillPack> = {}): SkillPack {
  return {
    id: 'pack-1',
    name: 'my-pack',
    description: 'load me',
    body: 'do the thing',
    body_hash: 'abc',
    created_at: '2026-08-22T00:00:00Z',
    updated_at: '2026-08-22T00:00:00Z',
    ...overrides
  }
}

describe('skillPacksStore', () => {
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockReset()
    vi.mocked(listSkillPacks).mockResolvedValue([])
    mocks.isFeatureEnabled.mockReset()
    mocks.isFeatureEnabled.mockReturnValue(true)
    mocks.onFeatureFlags.mockReset()
    mocks.reportError.mockReset()
  })

  it('stays disabled until the cohort flags resolve on', () => {
    const store = useSkillPacksStore()

    expect(store.enabled).toBe(false)

    store.flagsEnabled = true
    expect(store.enabled).toBe(true)
  })

  it('probes the routes when both feature flags enable the surface', async () => {
    const store = useSkillPacksStore()

    await store.startFlagGate()

    expect(mocks.isFeatureEnabled).toHaveBeenCalledWith(
      'agent-in-app-experience'
    )
    expect(mocks.isFeatureEnabled).toHaveBeenCalledWith('agent-skill-packs')
    expect(listSkillPacks).toHaveBeenCalledOnce()
  })

  it('allows the feature gate to retry after setup fails', async () => {
    const failure = new Error('subscription failed')
    mocks.onFeatureFlags.mockImplementationOnce(() => {
      throw failure
    })
    const store = useSkillPacksStore()

    await store.startFlagGate()
    await store.startFlagGate()

    expect(mocks.onFeatureFlags).toHaveBeenCalledTimes(2)
    expect(mocks.reportError).toHaveBeenCalledWith(failure, {
      errorType: 'agent_skill_packs_flag_gate_failure'
    })
    expect(listSkillPacks).toHaveBeenCalledOnce()
  })

  it('disables the surface when the routes answer 404 at runtime', async () => {
    vi.mocked(listSkillPacks).mockRejectedValue(
      new SkillPacksApiError('not found', 404)
    )
    const store = useSkillPacksStore()
    store.flagsEnabled = true

    await store.fetchPacks()

    expect(store.routesAvailable).toBe(false)
    expect(store.enabled).toBe(false)
    expect(store.packs).toEqual([])
  })

  it('re-probes unavailable routes when the settings gate starts again', async () => {
    vi.mocked(listSkillPacks)
      .mockRejectedValueOnce(new SkillPacksApiError('not found', 404))
      .mockResolvedValueOnce([makePack()])
    const store = useSkillPacksStore()

    await store.startFlagGate()
    await vi.waitFor(() => expect(store.routesAvailable).toBe(false))
    await store.startFlagGate()
    await vi.waitFor(() => expect(store.routesAvailable).toBe(true))

    expect(listSkillPacks).toHaveBeenCalledTimes(2)
    expect(store.packs).toEqual([makePack()])
  })

  it('rethrows a non-404 failure rather than hiding the surface', async () => {
    vi.mocked(listSkillPacks).mockRejectedValue(
      new SkillPacksApiError('boom', 500)
    )
    const store = useSkillPacksStore()
    store.flagsEnabled = true

    await expect(store.fetchPacks()).rejects.toThrow('boom')
    expect(store.routesAvailable).toBe(true)
  })

  it('ignores a list response that started before a local update', async () => {
    let resolveList!: (packs: SkillPack[]) => void
    vi.mocked(listSkillPacks).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve
      })
    )
    const store = useSkillPacksStore()

    const fetchPromise = store.fetchPacks()
    store.upsertPack(makePack({ body: 'new text' }))
    resolveList([makePack({ body: 'stale text' })])
    await fetchPromise

    expect(store.packs[0].body).toBe('new text')
    expect(store.loading).toBe(false)
  })

  it('replaces a pack of the same name instead of adding a second one', () => {
    const store = useSkillPacksStore()
    store.packs = [makePack({ name: 'a' }), makePack({ id: 'p2', name: 'b' })]

    store.upsertPack(makePack({ id: 'p3', name: 'a', body: 'new text' }))

    expect(store.packs.map((pack) => pack.name)).toEqual(['a', 'b'])
    expect(store.packs[0].body).toBe('new text')
  })

  it('totals description plus body across the packs', () => {
    const store = useSkillPacksStore()
    store.packs = [
      makePack({ name: 'a', description: 'ab', body: 'cde' }),
      makePack({ id: 'p2', name: 'b', description: 'f', body: 'gh' })
    ]

    expect(store.totalBytes).toBe(8)
  })
})
