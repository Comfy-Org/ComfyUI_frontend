import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  listBuiltinSkills,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import type { BuiltinSkill, SkillPack } from '@/platform/skills/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'

import { useBuiltinSkillsStore } from './builtinSkillsStore'
import { useSkillPacksStore } from './skillPacksStore'

const mocks = vi.hoisted(() => ({
  reportError: vi.fn()
}))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })

function makeSkill(overrides: Partial<BuiltinSkill> = {}): BuiltinSkill {
  return {
    name: 'batch-generation',
    description: 'Generate a batch of images',
    ...overrides
  }
}

function makePack(overrides: Partial<SkillPack> = {}): SkillPack {
  return {
    id: 'pack-1',
    name: 'product-ad',
    description: 'User product ad skill',
    body: 'User body',
    body_hash: 'hash-1',
    created_at: '2026-08-22T00:00:00Z',
    updated_at: '2026-08-22T00:00:00Z',
    ...overrides
  }
}

function deferredCatalog() {
  let resolve: (skills: BuiltinSkill[]) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<BuiltinSkill[]>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('builtinSkillsStore', () => {
  beforeEach(() => {
    vi.mocked(listBuiltinSkills).mockResolvedValue([])
    mocks.reportError.mockReset()
  })

  it('fetches once on ensureSkills and skips refetching on repeated opens', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce([makeSkill()])

    await store.ensureSkills()
    await store.ensureSkills()

    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)
    expect(store.skills).toEqual([makeSkill()])
    expect(store.visibleSkills).toEqual([makeSkill()])
    expect(store.hasLoaded).toBe(true)
    expect(store.catalogConfirmed).toBe(true)
    expect(store.routesAvailable).toBe(true)
    expect(store.loadFailed).toBe(false)
  })

  it('treats 404 as absent without failing, reporting, or retrying on ensureSkills', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockRejectedValueOnce(
      new SkillPacksApiError('Not found', 404)
    )

    await store.ensureSkills()
    await store.ensureSkills()

    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)
    expect(store.routesAvailable).toBe(false)
    expect(store.loadFailed).toBe(false)
    expect(store.catalogConfirmed).toBe(false)
    expect(store.skills).toEqual([])
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  it('keeps failed state across ensureSkills and recovers on explicit refreshSkills without touching user packs', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    skillPacks.upsertPack(makePack())
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockRejectedValueOnce(
      new SkillPacksApiError('Server error', 500)
    )

    await store.ensureSkills()
    expect(store.loadFailed).toBe(true)
    expect(store.routesAvailable).toBe(true)
    expect(mocks.reportError).toHaveBeenCalledTimes(1)

    await store.ensureSkills()
    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)

    vi.mocked(listBuiltinSkills).mockResolvedValueOnce([makeSkill()])
    await store.refreshSkills()

    expect(listBuiltinSkills).toHaveBeenCalledTimes(2)
    expect(store.loadFailed).toBe(false)
    expect(store.catalogConfirmed).toBe(true)
    expect(store.skills).toEqual([makeSkill()])
    expect(skillPacks.packs).toEqual([makePack()])
  })

  it('deduplicates concurrent refreshSkills requests', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    const pending = deferredCatalog()
    vi.mocked(listBuiltinSkills).mockReturnValueOnce(pending.promise)

    const first = store.refreshSkills()
    const second = store.refreshSkills()
    pending.resolve([makeSkill()])

    await Promise.all([first, second])
    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)
    expect(store.skills).toEqual([makeSkill()])
  })

  it('hides built-in skills shadowed by user packs and restores them when deleted', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce([
      makeSkill({ name: 'batch-generation' }),
      makeSkill({ name: 'product-ad', description: 'Built-in product ad' })
    ])

    await store.ensureSkills()
    expect(store.visibleSkills.map((skill) => skill.name)).toEqual([
      'batch-generation',
      'product-ad'
    ])

    skillPacks.upsertPack(makePack({ name: 'product-ad' }))
    expect(store.visibleSkills.map((skill) => skill.name)).toEqual([
      'batch-generation'
    ])
    expect(store.skills.map((skill) => skill.name)).toEqual([
      'batch-generation',
      'product-ad'
    ])

    skillPacks.removePack('product-ad')
    expect(store.visibleSkills.map((skill) => skill.name)).toEqual([
      'batch-generation',
      'product-ad'
    ])
    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)
  })

  it('clears state and discards stale responses when workspace scope changes', async () => {
    Object.assign(useCurrentUser(), {
      resolvedUserInfo: ref({ id: 'user-1' })
    })
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    const first = deferredCatalog()
    const second = deferredCatalog()
    vi.mocked(listBuiltinSkills)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const initialRequest = store.ensureSkills()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-2' })
    await nextTick()

    expect(store.skills).toEqual([])
    expect(store.catalogConfirmed).toBe(false)

    first.resolve([makeSkill({ name: 'stale-skill' })])
    await initialRequest
    expect(store.skills).toEqual([])

    second.resolve([makeSkill({ name: 'fresh-skill' })])
    await vi.waitFor(() =>
      expect(store.skills.map((skill) => skill.name)).toEqual(['fresh-skill'])
    )
  })

  it('clears cached built-in skills on sign-out, backend URL change, and feature flag off', async () => {
    const resolvedUserInfo = ref<{ id: string } | null>({ id: 'user-1' })
    Object.assign(useCurrentUser(), { resolvedUserInfo })

    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockResolvedValue([makeSkill()])

    await store.ensureSkills()
    expect(store.skills).toHaveLength(1)

    skillPacks.flagsEnabled = false
    expect(store.skills).toEqual([])
    expect(store.catalogConfirmed).toBe(false)

    skillPacks.flagsEnabled = true
    await vi.waitFor(() => expect(store.skills).toHaveLength(1))

    resolvedUserInfo.value = null
    expect(store.skills).toEqual([])
    expect(store.catalogConfirmed).toBe(false)

    resolvedUserInfo.value = { id: 'user-2' }
    await vi.waitFor(() => expect(store.skills).toHaveLength(1))

    vi.mocked(api.apiURL).mockReturnValue('https://other.example/api/agent')
    await store.ensureSkills()
    expect(listBuiltinSkills).toHaveBeenCalledTimes(4)
  })
})
