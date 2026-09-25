import { describe, expect, it } from 'vitest'
import { AUTO_DIRECTION } from './catalog'

import {
  composePlannedScene,
  composeSceneBrief,
  createSceneBuilderDraft,
  parseSceneBuilderDraft,
  sceneBuilderStorageKey,
  serializeSceneBuilderDraft,
  planSettingsSchema,
  plannedReferenceIds,
  plannedShotMetadata,
  createScenePlanLibrary,
  parseScenePlanLibrary,
  updateScenePlanLibrary,
  serializeScenePlanLibrary,
  PLAN_LIBRARY_LIMIT
} from './scene-builder'

describe('scene builder', () => {
  it('migrates a single draft and round trips independent named plans with stable identities', () => {
    const first = createSceneBuilderDraft('Harbor')
    first.plan.name = 'Harbor'
    const second = createSceneBuilderDraft('Forest')
    second.plan.name = 'Forest'
    const migrated = parseScenePlanLibrary(serializeSceneBuilderDraft(first))
    const library = updateScenePlanLibrary(migrated, second)
    const restored = parseScenePlanLibrary(serializeScenePlanLibrary(library))
    expect(restored.drafts).toEqual([first, second])
    expect(restored.activeId).toBe(second.plan.id)
    first.plan.shots[0].action = 'Changed outside storage'
    expect(restored.drafts[0].plan.shots[0].action).toBe('')
    expect(() =>
      parseScenePlanLibrary(JSON.stringify({ ...library, activeId: 'missing' }))
    ).toThrow()
    expect(() =>
      parseScenePlanLibrary(
        JSON.stringify({ ...library, drafts: [second, second] })
      )
    ).toThrow()
  })

  it('rejects collection overflow without pruning saved plans', () => {
    let library = createScenePlanLibrary(createSceneBuilderDraft('First'))
    for (let index = 1; index < PLAN_LIBRARY_LIMIT; index++)
      library = updateScenePlanLibrary(
        library,
        createSceneBuilderDraft(String(index))
      )
    expect(() =>
      updateScenePlanLibrary(library, createSceneBuilderDraft('Overflow'))
    ).toThrow()
    expect(library.drafts).toHaveLength(PLAN_LIBRARY_LIMIT)
    expect(library.drafts[0].plan.scene).toBe('First')
  })
  it('persists validated settings with all, selected and no reference semantics', () => {
    const draft = createSceneBuilderDraft('A cyclist')
    const input = {
      modelSlug: 'real-model',
      aspect: '16:9',
      resolution: '1K',
      takes: 1,
      direction: { ...AUTO_DIRECTION },
      referenceBundleId: 'a'.repeat(64),
      references: [
        { id: 'subject:', label: 'Subject' },
        { id: 'style:', label: 'Style' }
      ]
    }
    draft.plan.settings = planSettingsSchema.parse(input)
    input.direction.body = 'invalid'
    expect(draft.plan.settings.direction.body).toBe(AUTO_DIRECTION.body)
    expect(plannedReferenceIds(draft.plan, 0)).toEqual(['subject:', 'style:'])
    const before = plannedShotMetadata(draft.plan, 0)
    draft.plan.shots[0].referenceIds = ['style:', 'missing:']
    expect(plannedReferenceIds(draft.plan, 0)).toEqual(['style:'])
    expect(plannedShotMetadata(draft.plan, 0).snapshot).not.toBe(
      before.snapshot
    )
    draft.plan.shots[0].referenceIds = []
    const restored = parseSceneBuilderDraft(serializeSceneBuilderDraft(draft))
    expect(plannedReferenceIds(restored.plan, 0)).toEqual([])
    expect(restored.plan.settings?.enhance).toBe(false)
    expect(() =>
      planSettingsSchema.parse({
        ...input,
        direction: AUTO_DIRECTION,
        referenceBundleId: undefined
      })
    ).toThrow()
    expect(() =>
      planSettingsSchema.parse({
        ...input,
        direction: AUTO_DIRECTION,
        references: [{ id: 'https://host/image', label: 'URL' }]
      })
    ).toThrow()
  })
  it('can exclude the shared brief without removing the shot action and framing', () => {
    const { plan } = createSceneBuilderDraft('Shared scene')
    plan.character = 'Shared character'
    plan.continuity = 'Shared continuity'
    plan.shots[0].action = 'Private action'
    plan.shots[0].includeSharedBrief = false
    expect(composePlannedScene(plan, 0)).toContain('Private action')
    expect(composePlannedScene(plan, 0)).not.toContain('Shared')
    plan.scene = ''
    expect(() => composePlannedScene(plan, 0)).not.toThrow()
    const legacy = JSON.parse(
      serializeSceneBuilderDraft(createSceneBuilderDraft('Legacy'))
    )
    for (const shot of legacy.plan.shots) delete shot.includeSharedBrief
    expect(
      parseSceneBuilderDraft(JSON.stringify(legacy)).plan.shots.every(
        (shot) => shot.includeSharedBrief
      )
    ).toBe(true)
  })
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
