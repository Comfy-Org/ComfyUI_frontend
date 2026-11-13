import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import { useSkillDraftStore } from './skillDraftStore'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))

const PORTRAIT = {
  name: 'portrait',
  description: 'Compose a portrait',
  body: 'Keep the subject sharp'
}
const LANDSCAPE = {
  name: 'landscape',
  description: 'Compose a wide landscape',
  body: 'Use a wide lens'
}

describe('skillDraftStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reads a new-skill draft back from storage', () => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()
    const scope = skills.scope
    drafts.setDraft(scope, { kind: 'new' }, PORTRAIT)

    skills.scope = 'another-account'
    skills.scope = scope

    expect(drafts.newSkillDraft).toEqual(PORTRAIT)
  })

  it('keeps one edit draft per skill', () => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()

    drafts.setDraft(
      skills.scope,
      { kind: 'edit', name: 'landscape' },
      LANDSCAPE
    )

    expect(drafts.editDraftFor('landscape')).toEqual(LANDSCAPE)
    expect(drafts.editDraftFor('portrait')).toBeUndefined()
    expect(drafts.newSkillDraft).toBeNull()
  })

  it('removes the stored entry once the last draft is cleared', () => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()
    drafts.setDraft(skills.scope, { kind: 'new' }, PORTRAIT)
    drafts.setDraft(
      skills.scope,
      { kind: 'edit', name: 'landscape' },
      LANDSCAPE
    )

    drafts.setDraft(skills.scope, { kind: 'new' }, null)
    expect(
      localStorage.getItem(StorageKeys.agentSkillDrafts(skills.scope))
    ).not.toBeNull()
    drafts.setDraft(skills.scope, { kind: 'edit', name: 'landscape' }, null)

    expect(drafts.newSkillDraft).toBeNull()
    expect(drafts.editDraftFor('landscape')).toBeUndefined()
    expect(
      localStorage.getItem(StorageKeys.agentSkillDrafts(skills.scope))
    ).toBeNull()
  })

  it('keeps the drafts of different scopes apart', () => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()
    const firstScope = skills.scope
    drafts.setDraft(firstScope, { kind: 'new' }, PORTRAIT)

    skills.scope = 'another-account'
    expect(drafts.newSkillDraft).toBeNull()
    drafts.setDraft('another-account', { kind: 'new' }, LANDSCAPE)
    expect(drafts.newSkillDraft).toEqual(LANDSCAPE)

    skills.scope = firstScope
    expect(drafts.newSkillDraft).toEqual(PORTRAIT)
  })

  it('stores a draft for an earlier scope without showing it in the current one', () => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()
    const earlierScope = skills.scope
    skills.scope = 'another-account'

    drafts.setDraft(earlierScope, { kind: 'new' }, PORTRAIT)

    expect(drafts.newSkillDraft).toBeNull()
    skills.scope = earlierScope
    expect(drafts.newSkillDraft).toEqual(PORTRAIT)
  })

  it.for([
    ['text that is not JSON', 'not json'],
    ['JSON of the wrong shape', JSON.stringify({ newSkill: 'x', edits: [] })]
  ])('ignores stored data that is %s', ([, stored]) => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()
    const scope = skills.scope
    localStorage.setItem(StorageKeys.agentSkillDrafts(scope), stored)

    skills.scope = 'another-account'
    skills.scope = scope

    expect(drafts.newSkillDraft).toBeNull()
    expect(drafts.editDraftFor('landscape')).toBeUndefined()
  })
})
