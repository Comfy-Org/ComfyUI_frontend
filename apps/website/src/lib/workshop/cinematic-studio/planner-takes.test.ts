import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import CinematicSceneBuilder from '../../../components/workshop/cinematic-studio/CinematicSceneBuilder.vue'
import type { SavedCreation, CreationSettings } from './creations'
import { AUTO_DIRECTION } from './catalog'
import {
  createSceneBuilderDraft,
  parseSceneBuilderDraft,
  serializeSceneBuilderDraft,
  plannedShotMetadata,
  plannedShotTakes,
  planSettingsSchema,
  sceneBuilderStorageKey
} from './scene-builder'
import type { PlanShotMetadata } from './scene-builder'

function creation(
  plan: PlanShotMetadata,
  overrides: Partial<SavedCreation> = {}
): SavedCreation & { settings: CreationSettings & { plan: PlanShotMetadata } } {
  return {
    id: 'take-1',
    takeId: 'take-1',
    name: 'First take',
    modelSlug: 'model',
    prompt: 'Scene',
    aspect: '16:9',
    createdAt: 10,
    kind: 'image',
    fileName: 'take.png',
    nsfw: false,
    favorite: false,
    blob: new Blob(['image'], { type: 'image/png' }),
    ...overrides,
    settings: {
      scene: 'A coast',
      mode: 'image',
      enhance: false,
      direction: AUTO_DIRECTION,
      plan
    }
  }
}
describe('planned shot identities and takes', () => {
  it('captures independent studio settings and applies an explicit empty reference selection', async () => {
    const sharedSettings = planSettingsSchema.parse({
      modelSlug: 'studio-model',
      modelName: 'Studio model',
      aspect: '16:9',
      resolution: '2K',
      takes: 2,
      direction: AUTO_DIRECTION,
      referenceBundleId: 'a'.repeat(64),
      references: [{ id: 'subject:', label: 'Subject reference' }]
    })
    const user = userEvent.setup()
    const view = render(CinematicSceneBuilder, {
      props: {
        open: true,
        scene: 'A coast',
        namespace: 'planner-capture-test',
        sharedSettings
      }
    })
    await user.click(await screen.findByRole('button', { name: 'Plan shots' }))
    await user.click(
      screen.getByRole('button', { name: 'Use current studio settings' })
    )
    const card = screen.getAllByRole('article')[0]
    await user.click(within(card).getByText('Shared brief and references'))
    await user.click(
      within(card).getByRole('checkbox', { name: 'Subject reference' })
    )
    await view.rerender({
      sharedSettings: { ...sharedSettings, modelSlug: 'later-model' }
    })
    await user.click(
      within(card).getByRole('button', { name: 'Use this scene' })
    )
    const emitted = view.emitted().apply[0]
    expect(emitted).toEqual([
      expect.any(String),
      expect.any(Object),
      sharedSettings,
      []
    ])
    const saved = parseSceneBuilderDraft(
      localStorage.getItem(sceneBuilderStorageKey('planner-capture-test')) ?? ''
    )
    expect(saved.plan.settings?.modelSlug).toBe('studio-model')
    expect(saved.plan.shots[0].referenceIds).toEqual([])
  })
  it('migrates legacy v1 identities and retains them after serialization', () => {
    const draft = createSceneBuilderDraft('A harbor')
    const { id: _id, ...plan } = draft.plan
    const legacy = {
      ...draft,
      plan: {
        ...plan,
        shots: plan.shots.map(({ id: _shotId, ...shot }) => shot)
      }
    }
    const restored = parseSceneBuilderDraft(JSON.stringify(legacy))
    expect(restored.plan.id).toBeTruthy()
    expect(new Set(restored.plan.shots.map((shot) => shot.id)).size).toBe(3)
    expect(
      parseSceneBuilderDraft(serializeSceneBuilderDraft(restored))
    ).toEqual(restored)
    expect(createSceneBuilderDraft('A harbor').plan.id).not.toBe(
      restored.plan.id
    )
  })
  it('binds by plan and shot identities, retains old versions and ignores other cards and plans', () => {
    const draft = createSceneBuilderDraft('A coast')
    const metadata = plannedShotMetadata(draft.plan, 0)
    const item = creation(metadata)
    const unrelated = creation(
      plannedShotMetadata(createSceneBuilderDraft('A coast').plan, 0),
      { id: 'other-plan' }
    )
    const otherCard = creation(plannedShotMetadata(draft.plan, 1), {
      id: 'other-card'
    })
    expect(
      plannedShotTakes(draft.plan, 0, [item, unrelated, otherCard])
    ).toEqual([{ creation: item, previousVersion: false }])
    draft.plan.shots[0].action = 'Looks inland'
    expect(plannedShotTakes(draft.plan, 0, [item])[0].previousVersion).toBe(
      true
    )
    draft.plan.shots.reverse()
    expect(plannedShotTakes(draft.plan, 2, [item])[0].creation.id).toBe(item.id)
    draft.plan.scene = ''
    expect(plannedShotTakes(draft.plan, 2, [item])[0].previousVersion).toBe(
      true
    )
  })
  it('rejects duplicate shot identities and malformed metadata', () => {
    const draft = createSceneBuilderDraft('A coast')
    draft.plan.shots[1].id = draft.plan.shots[0].id
    expect(() => parseSceneBuilderDraft(JSON.stringify(draft))).toThrow()
    const valid = createSceneBuilderDraft('A coast')
    const malformed = creation({
      planId: valid.plan.id,
      shotId: valid.plan.shots[0].id,
      snapshot: ''
    })
    expect(plannedShotTakes(valid.plan, 0, [malformed])).toEqual([])
  })
  it('saves a plan before applying a card and emits stable metadata without generation', async () => {
    const namespace = 'planner-apply-test'
    const user = userEvent.setup()
    const view = render(CinematicSceneBuilder, {
      props: { open: true, scene: 'A coast', namespace }
    })
    await user.click(await screen.findByRole('button', { name: 'Plan shots' }))
    await user.click(
      screen.getAllByRole('button', { name: 'Use this scene' })[0]
    )
    const saved = parseSceneBuilderDraft(
      localStorage.getItem(sceneBuilderStorageKey(namespace)) ?? ''
    )
    expect(view.emitted().apply).toEqual([
      [expect.any(String), plannedShotMetadata(saved.plan, 0)]
    ])
    await view.rerender({ open: false })
    await view.rerender({ open: true })
    expect(
      await screen.findByRole('textbox', {
        name: 'Shared scene'
      })
    ).toHaveValue('A coast')
    expect(
      parseSceneBuilderDraft(
        localStorage.getItem(sceneBuilderStorageKey(namespace)) ?? ''
      ).plan.id
    ).toBe(saved.plan.id)
  })
  it('does not expose sensitive sources or editing actions until reveal and scopes reveal to reopening', async () => {
    const draft = createSceneBuilderDraft('A coast')
    const namespace = 'planner-sensitive-test'
    localStorage.setItem(
      sceneBuilderStorageKey(namespace),
      serializeSceneBuilderDraft(draft)
    )
    const item = creation(plannedShotMetadata(draft.plan, 0), { nsfw: true })
    const user = userEvent.setup()
    const view = render(CinematicSceneBuilder, {
      props: {
        open: true,
        scene: '',
        namespace,
        creations: [item],
        urls: { [item.id]: 'blob:private-output' }
      }
    })
    await user.click(await screen.findByRole('button', { name: 'Plan shots' }))
    const card = screen.getAllByRole('article')[0]
    await user.click(within(card).getByText('Saved takes · 1'))
    expect(within(card).queryByRole('img')).toBeNull()
    expect(
      within(card).queryByRole('button', { name: 'Edit frame' })
    ).toBeNull()
    await user.click(
      within(card).getByRole('button', { name: 'Reveal this take' })
    )
    expect(within(card).getByRole('img', { name: item.name })).toHaveAttribute(
      'src',
      'blob:private-output'
    )
    await user.click(within(card).getByRole('button', { name: 'Edit frame' }))
    expect(view.emitted().edit).toEqual([[item]])
    await view.rerender({ open: false })
    await view.rerender({ open: true })
    expect(screen.queryByRole('img', { name: item.name })).toBeNull()
    await view.rerender({ namespace: 'another-workspace' })
    expect(screen.queryByText('Saved takes · 1')).toBeNull()
  })
})
