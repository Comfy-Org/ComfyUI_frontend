import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listSkillPacks, SkillPacksApiError } from '../api/skillsApi'
import type { SkillPack } from '../types'
import { useSkillPacksStore } from './skillPacksStore'

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
    setActivePinia(createPinia())
    vi.mocked(listSkillPacks).mockReset()
  })

  it('stays disabled until the cohort flags resolve on', () => {
    const store = useSkillPacksStore()

    expect(store.enabled).toBe(false)

    store.flagsEnabled = true
    expect(store.enabled).toBe(true)
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

  it('rethrows a non-404 failure rather than hiding the surface', async () => {
    vi.mocked(listSkillPacks).mockRejectedValue(
      new SkillPacksApiError('boom', 500)
    )
    const store = useSkillPacksStore()
    store.flagsEnabled = true

    await expect(store.fetchPacks()).rejects.toThrow('boom')
    expect(store.routesAvailable).toBe(true)
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
