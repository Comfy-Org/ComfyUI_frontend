import { describe, expect, it, vi } from 'vitest'

import { useBuiltinSkillsStore } from '@/platform/skills/stores/builtinSkillsStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'

import {
  useBuiltinSkillCatalogStatus,
  useSkillCatalogStatus
} from './useSkillCatalogStatus'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))

describe('useSkillCatalogStatus', () => {
  it.for([
    { when: 'nothing was requested yet', state: {}, status: 'loading' },
    {
      when: 'the first listing is in flight',
      state: { loading: true },
      status: 'loading'
    },
    {
      when: 'a refresh is in flight after a confirmed listing',
      state: { loading: true, catalogConfirmed: true },
      status: 'empty'
    },
    {
      when: 'a confirmed listing is empty',
      state: { catalogConfirmed: true },
      status: 'empty'
    },
    {
      when: 'the listing failed',
      state: { loadFailed: true },
      status: 'failed'
    },
    {
      when: 'a refresh failed after a confirmed listing',
      state: { catalogConfirmed: true, loadFailed: true },
      status: 'failed'
    }
  ] as const)('is $status when $when', ({ state, status }) => {
    Object.assign(useSkillPacksStore(), state)

    expect(useSkillCatalogStatus().value).toBe(status)
  })

  it('has no status once there are skills', () => {
    useSkillPacksStore().upsertPack({
      id: 'pack-1',
      name: 'portrait',
      description: 'Compose a portrait',
      body: 'Keep the subject sharp',
      body_hash: 'abc',
      created_at: '2026-08-22T00:00:00Z',
      updated_at: '2026-08-22T00:00:00Z'
    })

    expect(useSkillCatalogStatus().value).toBeUndefined()
  })
})

describe('useBuiltinSkillCatalogStatus', () => {
  it.for([
    { when: 'nothing was requested yet', state: {}, status: undefined },
    {
      when: 'the first listing was requested',
      state: { catalogRequested: true },
      status: 'loading'
    },
    {
      when: 'the first listing is in flight',
      state: { loading: true },
      status: 'loading'
    },
    {
      when: 'a refresh is in flight after a confirmed empty listing',
      state: { loading: true, catalogConfirmed: true },
      status: undefined
    },
    {
      when: 'the backend answered 404',
      state: { routesAvailable: false, catalogRequested: true },
      status: undefined
    },
    {
      when: 'a confirmed listing is empty',
      state: { catalogConfirmed: true },
      status: undefined
    },
    {
      when: 'the listing failed',
      state: { loadFailed: true },
      status: 'failed'
    }
  ] as const)('is $status when $when', ({ state, status }) => {
    Object.assign(useBuiltinSkillsStore(), state)

    expect(useBuiltinSkillCatalogStatus().value).toBe(status)
  })

  it('has no status when visible built-in skills exist or all built-in skills are shadowed', () => {
    const builtinSkills = useBuiltinSkillsStore()
    builtinSkills.skills = [
      { name: 'product-ad', description: 'Built-in product ad' }
    ]
    builtinSkills.catalogConfirmed = true

    expect(useBuiltinSkillCatalogStatus().value).toBeUndefined()

    useSkillPacksStore().upsertPack({
      id: 'pack-1',
      name: 'product-ad',
      description: 'User product ad',
      body: 'User body',
      body_hash: 'abc',
      created_at: '2026-08-22T00:00:00Z',
      updated_at: '2026-08-22T00:00:00Z'
    })

    expect(useBuiltinSkillCatalogStatus().value).toBeUndefined()
  })
})
