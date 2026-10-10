import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
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
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<SkillPack[]>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('skillPacksStore', () => {
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockResolvedValue([])
    mocks.isFeatureEnabled.mockReturnValue(true)
  })

  it.for(['refreshPacks', 'refreshPacksInBackground'] as const)(
    'keeps the confirmed catalog while %s is pending or fails, then applies a successful result',
    async (refresh) => {
      const store = useSkillPacksStore()
      store.flagsEnabled = true
      vi.mocked(listSkillPacks).mockResolvedValueOnce([makePack()])
      await store.refreshPacks()
      const pending = deferredCatalog()
      vi.mocked(listSkillPacks).mockReturnValueOnce(pending.promise)
      const request = store[refresh]()
      expect(store.loading).toBe(true)
      expect(store.catalogConfirmed).toBe(true)
      expect(store.packs).toEqual([makePack()])
      const replaced = makePack({ id: 'pack-2', name: 'replaced' })
      pending.resolve([replaced])
      await request
      expect(store.catalogConfirmed).toBe(true)
      expect(store.packs).toEqual([replaced])
      vi.mocked(listSkillPacks).mockRejectedValueOnce(
        new SkillPacksApiError('failed', 503)
      )
      await store[refresh]()
      expect(store.catalogConfirmed).toBe(true)
      expect(store.loadFailed).toBe(true)
      expect(store.packs).toEqual([replaced])
      expect(store.enabled).toBe(true)
    }
  )

  it.for<{
    change: string
    apply: (store: ReturnType<typeof useSkillPacksStore>) => void
    expected: string[]
  }>([
    {
      change: 'upsert',
      apply: (store) =>
        store.upsertPack(makePack({ id: 'pack-2', name: 'created' })),
      expected: ['created', 'my-pack']
    },
    {
      change: 'remove',
      apply: (store) => store.removePack('my-pack'),
      expected: []
    }
  ])(
    'keeps a confirmed catalog confirmed when a local $change supersedes a refresh',
    async ({ apply, expected }) => {
      const store = useSkillPacksStore()
      store.flagsEnabled = true
      vi.mocked(listSkillPacks).mockResolvedValueOnce([makePack()])
      await store.refreshPacks()
      const pending = deferredCatalog()
      vi.mocked(listSkillPacks).mockReturnValueOnce(pending.promise)
      const refresh = store.refreshPacks()
      apply(store)
      pending.resolve([makePack({ id: 'pack-3', name: 'stale' })])
      await refresh
      expect(store.catalogConfirmed).toBe(true)
      expect(store.loading).toBe(false)
      expect(store.packs.map((pack) => pack.name)).toEqual(expected)
    }
  )

  it('leaves a never-confirmed catalog unconfirmed when local CRUD supersedes its first listing', async () => {
    const store = useSkillPacksStore()
    store.flagsEnabled = true
    const pending = deferredCatalog()
    vi.mocked(listSkillPacks).mockReturnValueOnce(pending.promise)
    const refresh = store.refreshPacks()
    store.upsertPack(makePack())
    pending.resolve([makePack(), makePack({ id: 'pack-2', name: 'other' })])
    await refresh
    expect(store.catalogConfirmed).toBe(false)
    store.removePack('my-pack')
    expect(store.catalogConfirmed).toBe(false)
  })

  it('invalidates route availability on a background 404', async () => {
    const store = useSkillPacksStore()
    store.flagsEnabled = true
    vi.mocked(listSkillPacks).mockResolvedValueOnce([makePack()])
    await store.refreshPacks()
    vi.mocked(listSkillPacks).mockRejectedValueOnce(
      new SkillPacksApiError('disabled', 404)
    )
    await store.refreshPacksInBackground()
    expect(store.catalogConfirmed).toBe(false)
    expect(store.enabled).toBe(false)
    expect(store.packs).toEqual([])
  })

  it('queues a terminal refresh after an earlier request and ignores a waiting refresh after scope changes', async () => {
    const store = useSkillPacksStore()
    store.flagsEnabled = true
    const first = deferredCatalog()
    vi.mocked(listSkillPacks)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([])
    const initial = store.refreshPacks()
    const terminal = store.refreshPacksInBackground()
    expect(listSkillPacks).toHaveBeenCalledOnce()
    first.resolve([makePack()])
    await Promise.all([initial, terminal])
    expect(listSkillPacks).toHaveBeenCalledTimes(2)
    expect(store.packs).toEqual([])
    const next = deferredCatalog()
    vi.mocked(listSkillPacks).mockReturnValueOnce(next.promise)
    const foreground = store.refreshPacks()
    const waiting = store.refreshPacksInBackground()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'new-scope' })
    next.resolve([makePack()])
    await Promise.all([foreground, waiting])
    expect(store.catalogConfirmed).toBe(false)
    expect(store.packs).toEqual([])
    expect(listSkillPacks).toHaveBeenCalledTimes(3)
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

  it.for<{
    change: string
    apply: (user: Ref<{ id: string }>) => void
  }>([
    {
      change: 'account',
      apply: (user) => {
        user.value = { id: 'user-b' }
      }
    },
    {
      change: 'workspace',
      apply: () => {
        Object.assign(useTeamWorkspaceStore(), { workspaceId: 'workspace-b' })
      }
    },
    {
      change: 'backend',
      apply: () => {
        vi.mocked(api.apiURL).mockImplementation((route) => `/other${route}`)
      }
    }
  ])(
    'unconfirms the catalog on $change change and ignores old-scope responses and CRUD',
    async ({ apply }) => {
      const user = ref({ id: 'user-a' })
      Object.assign(useCurrentUser(), { resolvedUserInfo: user })
      const store = useSkillPacksStore()
      vi.mocked(listSkillPacks).mockResolvedValueOnce([makePack()])
      await store.fetchPacks()
      const oldScope = store.scope
      const pending = deferredCatalog()
      vi.mocked(listSkillPacks).mockReturnValueOnce(pending.promise)
      const request = store.fetchPacks()
      apply(user)
      pending.resolve([makePack({ name: 'old-scope-listing' })])
      await request
      expect(store.packs).not.toContainEqual(
        makePack({ name: 'old-scope-listing' })
      )
      store.upsertPack(makePack({ name: 'old-scope-crud' }), oldScope)
      expect(store.catalogConfirmed).toBe(false)
      expect(store.packs).toEqual([])
    }
  )

  it.for<{
    outcome: string
    settle: (listing: ReturnType<typeof deferredCatalog>) => void
  }>([
    {
      outcome: 'returns',
      settle: (listing) => listing.resolve([makePack({ name: 'old-backend' })])
    },
    {
      outcome: 'fails',
      settle: (listing) => listing.reject(new SkillPacksApiError('down', 503))
    }
  ])(
    'moves to the new backend scope when a listing from the old backend $outcome',
    async ({ settle }) => {
      const store = useSkillPacksStore()
      vi.mocked(listSkillPacks).mockResolvedValueOnce([makePack()])
      await store.fetchPacks()
      const oldScope = store.scope
      const listing = deferredCatalog()
      vi.mocked(listSkillPacks).mockReturnValueOnce(listing.promise)
      const request = store.fetchPacks()
      vi.mocked(api.apiURL).mockImplementation((route) => `/other${route}`)
      settle(listing)
      await request
      expect(store.scope).not.toBe(oldScope)
      expect(store.catalogConfirmed).toBe(false)
      expect(store.packs).toEqual([])
      expect(store.loading).toBe(false)
    }
  )

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
