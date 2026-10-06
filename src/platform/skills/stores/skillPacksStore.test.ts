import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'

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

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))

vi.mock(import('../api/skillsApi'), { spy: true })

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

function deferredCatalog() {
  let resolve: (packs: SkillPack[]) => void = () => {}
  const promise = new Promise<SkillPack[]>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('skillPacksStore', () => {
  it('keeps cached packs during refresh and deduplicates concurrent refresh requests', async () => {
    const store = useSkillPacksStore()
    store.flagsEnabled = true
    store.upsertPack(makePack())
    const deferred = deferredCatalog()
    vi.mocked(listSkillPacks).mockReturnValueOnce(deferred.promise)
    const first = store.refreshPacks()
    const second = store.refreshPacks()
    expect(store.loading).toBe(true)
    expect(store.packs).toEqual([makePack()])
    expect(listSkillPacks).toHaveBeenCalledOnce()
    const created = makePack({ name: 'created-by-agent' })
    deferred.resolve([created])
    await Promise.all([first, second])
    expect(store.packs).toEqual([created])
    expect(store.loading).toBe(false)
  })

  it('retains cached packs after a failed refresh and accepts a later refresh', async () => {
    const store = useSkillPacksStore()
    store.flagsEnabled = true
    store.upsertPack(makePack())
    vi.mocked(listSkillPacks).mockRejectedValueOnce(
      new SkillPacksApiError('unavailable', 503)
    )
    await store.refreshPacks()
    expect(store.packs).toEqual([makePack()])
    expect(store.loadFailed).toBe(true)
    expect(store.loading).toBe(false)
    const created = makePack({ name: 'created-by-agent' })
    vi.mocked(listSkillPacks).mockResolvedValueOnce([created])
    await store.refreshPacks()
    expect(store.packs).toEqual([created])
    expect(store.loadFailed).toBe(false)
  })
  it('retries a failed refresh even when a catalog was previously loaded', async () => {
    vi.mocked(listSkillPacks)
      .mockResolvedValueOnce([makePack()])
      .mockRejectedValueOnce(new SkillPacksApiError('unavailable', 503))
      .mockResolvedValueOnce([makePack({ name: 'updated-pack' })])
    const store = useSkillPacksStore()
    store.flagsEnabled = true
    await store.ensurePacks()
    await expect(store.fetchPacks()).rejects.toThrow('unavailable')
    expect(store.loadFailed).toBe(true)
    await store.ensurePacks()
    expect(listSkillPacks).toHaveBeenCalledTimes(3)
    expect(store.loadFailed).toBe(false)
    expect(store.packs[0].name).toBe('updated-pack')
  })
  it('supports lazy composer loading and shares one concurrent catalog request with Settings', async () => {
    const deferred = deferredCatalog()
    vi.mocked(listSkillPacks).mockReturnValue(deferred.promise)
    const store = useSkillPacksStore()
    await store.startFlagGate({ fetch: false })
    expect(store.enabled).toBe(true)
    expect(listSkillPacks).not.toHaveBeenCalled()
    const composerLoad = store.ensurePacks()
    const settingsLoad = store.fetchPacks()
    expect(listSkillPacks).toHaveBeenCalledOnce()
    expect(store.loading).toBe(true)
    deferred.resolve([makePack()])
    await Promise.all([composerLoad, settingsLoad])
    expect(store.packs).toEqual([makePack()])
    expect(store.loading).toBe(false)
  })

  it('clears the catalog on account change and ignores the old response and CRUD updates', async () => {
    const user = ref({ id: 'user-a' })
    Object.assign(useCurrentUser(), { resolvedUserInfo: user })
    const store = useSkillPacksStore()
    store.packs = [makePack()]
    store.hasLoaded = true
    const oldScope = store.scope
    const deferred = deferredCatalog()
    vi.mocked(listSkillPacks).mockReturnValue(deferred.promise)
    const pending = store.fetchPacks()
    user.value = { id: 'user-b' }
    expect(store.packs).toEqual([])
    expect(store.hasLoaded).toBe(false)
    store.upsertPack(makePack(), oldScope)
    deferred.resolve([makePack()])
    await pending
    expect(store.packs).toEqual([])
  })

  it('invalidates a workspace catalog before serving cached data', () => {
    const workspace = useTeamWorkspaceStore()
    Object.assign(workspace, { workspaceId: 'workspace-a' })
    const store = useSkillPacksStore()
    store.upsertPack(makePack())
    const oldScope = store.scope
    Object.assign(workspace, { workspaceId: 'workspace-b' })
    expect(store.scope).not.toBe(oldScope)
    expect(store.packs).toEqual([])
    expect(store.hasLoaded).toBe(false)
  })

  it('discards a response from a previous backend and re-fetches on the next request', async () => {
    const store = useSkillPacksStore()
    store.flagsEnabled = true
    const deferred = deferredCatalog()
    vi.mocked(listSkillPacks).mockReturnValueOnce(deferred.promise)
    const pending = store.fetchPacks()
    vi.mocked(api.apiURL).mockImplementation((route) => `/other${route}`)
    deferred.resolve([makePack()])
    await pending
    expect(store.packs).toEqual([])
    await store.ensurePacks()
    expect(listSkillPacks).toHaveBeenCalledTimes(2)
  })

  it('exposes a retryable catalog error, then shares the successful retry', async () => {
    vi.mocked(listSkillPacks)
      .mockRejectedValueOnce(new SkillPacksApiError('unavailable', 503))
      .mockResolvedValueOnce([makePack()])
    const store = useSkillPacksStore()
    store.flagsEnabled = true
    await store.ensurePacks()
    expect(store.loadFailed).toBe(true)
    expect(store.enabled).toBe(true)
    await store.ensurePacks()
    expect(store.loadFailed).toBe(false)
    expect(store.packs).toEqual([makePack()])
  })
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockResolvedValue([])
    mocks.isFeatureEnabled.mockReturnValue(true)
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

  it.for([
    [false, true],
    [true, false]
  ])(
    'hides the surface unless both flags enable it (%s, %s)',
    async ([parentEnabled, childEnabled]) => {
      mocks.isFeatureEnabled.mockImplementation((flag: string) =>
        flag === 'agent-in-app-experience' ? parentEnabled : childEnabled
      )
      const store = useSkillPacksStore()

      await store.startFlagGate()

      expect(store.enabled).toBe(false)
      expect(listSkillPacks).not.toHaveBeenCalled()
    }
  )

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
      errorType: 'agent_skill_packs_flag_gate_failure',
      surface: 'agent'
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
})
