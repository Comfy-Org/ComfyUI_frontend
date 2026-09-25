import { describe, expect, it } from 'vitest'

import {
  composePlannedScene,
  composeSceneBrief,
  createSceneBuilderDraft,
  parseSceneBuilderDraft,
  sceneBuilderStorageKey,
  serializeSceneBuilderDraft
} from './scene-builder'

describe('scene builder', () => {
  it('organizes entered words without rewriting them or mutating the draft', () => {
    const { brief } = createSceneBuilderDraft('  A cyclist  ')
    brief.action = 'turns left'
    brief.setting = 'rainy street'
    brief.constraints = 'Keep the red coat'
    expect(composeSceneBrief(brief)).toBe(
      'A cyclist\n\nAction: turns left\n\nSetting: rainy street\n\nKeep or avoid: Keep the red coat'
    )
    expect(brief.subject).toBe('  A cyclist  ')
  })

  it.for([
    { name: 'empty subject', subject: ' ', action: '' },
    { name: 'combined scene too long', subject: 'a'.repeat(7999), action: 'b' }
  ])('rejects $name', ({ subject, action }) => {
    const draft = createSceneBuilderDraft(subject)
    draft.brief.action = action
    expect(() => composeSceneBrief(draft.brief)).toThrow()
  })

  it('accepts exactly 8000 scene characters', () => {
    expect(
      composeSceneBrief(createSceneBuilderDraft('a'.repeat(8000)).brief)
    ).toHaveLength(8000)
  })

  it('shares character and setting while keeping shot actions and framing separate', () => {
    const { plan } = createSceneBuilderDraft('An explorer arrives')
    plan.character = 'Blue coat'
    plan.setting = 'An old station'
    plan.shots[0].framing = 'Wide'
    plan.shots[0].action = 'Opens the door'
    plan.shots[1].framing = 'Medium'
    plan.shots[1].action = 'Checks the clock'
    expect(composePlannedScene(plan, 0)).toBe(
      'Wide\n\nAn explorer arrives\n\nCharacter: Blue coat\n\nSetting: An old station\n\nAction: Opens the door\n\nOne film still. Follow the shot framing above; retain the scene, people and clothing.'
    )
    expect(composePlannedScene(plan, 1)).toContain('Action: Checks the clock')
    expect(composePlannedScene(plan, 1)).not.toContain('Opens the door')
  })

  it('round trips editable drafts through a versioned JSON format', () => {
    const draft = createSceneBuilderDraft('A harbor')
    draft.plan.shots[2].action = 'Holds a compass'
    expect(parseSceneBuilderDraft(serializeSceneBuilderDraft(draft))).toEqual(
      draft
    )
  })

  it.for([
    { name: 'wrong version', patch: { version: 2 } },
    { name: 'credentials', patch: { token: 'secret' } },
    { name: 'media references', patch: { files: ['signed-url'] } },
    {
      name: 'missing shots',
      patch: {
        plan: {
          scene: 'night',
          character: '',
          setting: '',
          continuity: '',
          shots: []
        }
      }
    }
  ])('rejects imported $name', ({ patch }) => {
    expect(() =>
      parseSceneBuilderDraft(
        JSON.stringify({ ...createSceneBuilderDraft('A harbor'), ...patch })
      )
    ).toThrow()
  })

  it('rejects shots whose combined prompt exceeds the scene limit', () => {
    const { plan } = createSceneBuilderDraft('a'.repeat(8000))
    expect(() => composePlannedScene(plan, 0)).toThrow()
  })

  it('keeps draft storage scoped and rejects an absent scope', () => {
    expect(sceneBuilderStorageKey('demo')).not.toBe(
      sceneBuilderStorageKey('["user","workspace"]')
    )
    expect(() => sceneBuilderStorageKey('')).toThrow()
  })
})
