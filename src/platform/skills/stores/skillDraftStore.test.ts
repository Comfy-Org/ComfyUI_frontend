import { describe, expect, it, vi } from 'vitest'

import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import {
  completeWorkflowLogoutTransition,
  prepareWorkflowLogoutTransition
} from '@/platform/workflow/persistence/base/storageIO'
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

  it('keeps a newer draft that another window wrote when clearing the submitted one', () => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()
    const scope = skills.scope
    drafts.setDraft(scope, { kind: 'new' }, PORTRAIT)
    localStorage.setItem(
      StorageKeys.agentSkillDrafts(scope),
      JSON.stringify({
        newSkill: { ...PORTRAIT, body: 'Edited in another window' },
        edits: {}
      })
    )

    drafts.clearDraftIfUnchanged(scope, { kind: 'new' }, PORTRAIT)

    expect(drafts.newSkillDraft?.body).toBe('Edited in another window')
    expect(localStorage.getItem(StorageKeys.agentSkillDrafts(scope))).toContain(
      'Edited in another window'
    )
  })

  it('clears the draft when it still equals the submitted one', () => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()
    drafts.setDraft(skills.scope, { kind: 'new' }, PORTRAIT)

    drafts.clearDraftIfUnchanged(skills.scope, { kind: 'new' }, PORTRAIT)

    expect(drafts.newSkillDraft).toBeNull()
  })

  it.for(['landscape', '__proto__', 'constructor', 'toString'])(
    'reads back the edit draft of a skill named %s from storage',
    (name) => {
      const skills = useSkillPacksStore()
      const drafts = useSkillDraftStore()
      const scope = skills.scope
      drafts.setDraft(scope, { kind: 'edit', name }, { ...LANDSCAPE, name })

      skills.scope = 'another-account'
      skills.scope = scope

      expect(drafts.editDraftFor(name)).toEqual({ ...LANDSCAPE, name })
    }
  )

  it.for(['__proto__', 'constructor', 'toString'])(
    'has no edit draft for a skill named %s that was never edited',
    (name) => {
      const drafts = useSkillDraftStore()

      expect(drafts.editDraftFor(name)).toBeUndefined()
    }
  )

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

  it('writes no draft while a sign-out is clearing storage', () => {
    const skills = useSkillPacksStore()
    const drafts = useSkillDraftStore()
    prepareWorkflowLogoutTransition()
    try {
      drafts.setDraft(skills.scope, { kind: 'new' }, PORTRAIT)
    } finally {
      completeWorkflowLogoutTransition()
    }

    expect(
      localStorage.getItem(StorageKeys.agentSkillDrafts(skills.scope))
    ).toBeNull()
    expect(drafts.newSkillDraft).toBeNull()
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
