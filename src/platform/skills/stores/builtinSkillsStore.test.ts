import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  listBuiltinSkills,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import type { BuiltinSkillsListResult } from '@/platform/skills/api/skillsApi'
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
  let resolve: (result: BuiltinSkillsListResult) => void = () => {}
  const promise = new Promise<BuiltinSkillsListResult>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('builtinSkillsStore', () => {
  beforeEach(() => {
    vi.mocked(listBuiltinSkills).mockResolvedValue({ status: 'ok', skills: [] })
    mocks.reportError.mockReset()
  })

  it('fetches once on ensureSkills and skips refetching on repeated opens', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'ok',
      skills: [makeSkill()]
    })

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

  it('waits for an active in-flight request when a second caller awaits ensureSkills', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    const pending = deferredCatalog()
    vi.mocked(listBuiltinSkills).mockReturnValueOnce(pending.promise)

    const first = store.ensureSkills()
    let secondSettled = false
    const second = store.ensureSkills().then(() => {
      secondSettled = true
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(secondSettled).toBe(false)

    pending.resolve({ status: 'ok', skills: [makeSkill()] })
    await Promise.all([first, second])

    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)
    expect(secondSettled).toBe(true)
    expect(store.skills).toEqual([makeSkill()])
    expect(store.catalogConfirmed).toBe(true)
  })

  it('treats unavailable as absent without failing, reporting, or retrying on ensureSkills', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'unavailable'
    })

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
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'error',
      error: new SkillPacksApiError('Server error', 500)
    })

    await store.ensureSkills()
    expect(store.loadFailed).toBe(true)
    expect(store.routesAvailable).toBe(true)
    expect(mocks.reportError).toHaveBeenCalledTimes(1)

    await store.ensureSkills()
    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)

    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'ok',
      skills: [makeSkill()]
    })
    await store.refreshSkills()

    expect(listBuiltinSkills).toHaveBeenCalledTimes(2)
    expect(store.loadFailed).toBe(false)
    expect(store.catalogConfirmed).toBe(true)
    expect(store.skills).toEqual([makeSkill()])
    expect(skillPacks.packs).toEqual([makePack()])
  })

  it('reports a 401 built-in listing failure to Datadog only and keeps other failures on default reporting', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    const denied = new SkillPacksApiError('invalid session cookie', 401)
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'error',
      error: denied
    })

    await store.ensureSkills()

    expect(mocks.reportError).toHaveBeenCalledWith(denied, {
      errorType: 'error_fetching_agent_builtin_skills',
      surface: 'agent',
      sentryMode: 'never'
    })

    const failure = new SkillPacksApiError('boom', 500)
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'error',
      error: failure
    })

    await store.refreshSkills()

    expect(mocks.reportError).toHaveBeenLastCalledWith(failure, {
      errorType: 'error_fetching_agent_builtin_skills',
      surface: 'agent'
    })
  })

  it('retains loaded skills and reports once when concurrent refreshSkills calls fail', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'ok',
      skills: [makeSkill()]
    })
    await store.ensureSkills()

    const pending = deferredCatalog()
    vi.mocked(listBuiltinSkills).mockReturnValueOnce(pending.promise)

    const first = store.refreshSkills()
    const second = store.refreshSkills()
    pending.resolve({
      status: 'error',
      error: new SkillPacksApiError('Server error', 500)
    })

    await Promise.all([first, second])
    expect(listBuiltinSkills).toHaveBeenCalledTimes(2)
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
    expect(store.loadFailed).toBe(true)
    expect(store.skills).toEqual([makeSkill()])
    expect(store.catalogConfirmed).toBe(true)
  })

  it('deduplicates concurrent refreshSkills requests', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    const pending = deferredCatalog()
    vi.mocked(listBuiltinSkills).mockReturnValueOnce(pending.promise)

    const first = store.refreshSkills()
    const second = store.refreshSkills()
    pending.resolve({ status: 'ok', skills: [makeSkill()] })

    await Promise.all([first, second])
    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)
    expect(store.skills).toEqual([makeSkill()])
  })

  it('hides built-in skills shadowed by user packs and restores them when deleted', async () => {
    const skillPacks = useSkillPacksStore()
    skillPacks.flagsEnabled = true
    const store = useBuiltinSkillsStore()
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'ok',
      skills: [
        makeSkill({ name: 'batch-generation' }),
        makeSkill({ name: 'product-ad', description: 'Built-in product ad' })
      ]
    })

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

    first.resolve({
      status: 'ok',
      skills: [makeSkill({ name: 'stale-skill' })]
    })
    await initialRequest
    expect(store.skills).toEqual([])

    second.resolve({
      status: 'ok',
      skills: [makeSkill({ name: 'fresh-skill' })]
    })
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
    vi.mocked(listBuiltinSkills).mockResolvedValue({
      status: 'ok',
      skills: [makeSkill()]
    })

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
