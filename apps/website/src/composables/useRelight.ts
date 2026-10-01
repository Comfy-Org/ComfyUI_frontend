import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { Locale } from '../i18n/translations'
import { imageSize } from '../lib/workshop/image-size'
import { lc } from '../lib/workshop/relight/copy'
import type {
  Light,
  LightKind,
  MoodId,
  RelightGeneration,
  RelightMask,
  RelightScene
} from '../lib/workshop/relight/lights'
import {
  DEFAULT_GENERATION,
  DEFAULT_SCENE,
  MAX_LIGHTS,
  moodLights,
  newLight,
  newMask
} from '../lib/workshop/relight/lights'
import type { RelightResult } from '../lib/workshop/relight/mock-run'
import {
  RELIGHT_EXAMPLE,
  relightRequest,
  runRelight
} from '../lib/workshop/relight/mock-run'

export interface RelightImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

/** Everything undo and redo cover. */
interface RelightSetup {
  readonly lights: readonly Light[]
  readonly mood: MoodId
  readonly scene: RelightScene
  readonly masks: readonly RelightMask[]
  readonly generation: RelightGeneration
}

type RelightPhase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'running'; readonly startedAt: number }
  | { readonly kind: 'done'; readonly result: RelightResult }
  | { readonly kind: 'failed' }

export type RelightTray = 'lights' | 'scene' | 'masks' | 'generation'
export type RelightView = 'live' | 'original' | 'lightmap'

/** Relight's page state. The run itself is `runRelight`, mocked for now. */
export function useRelight(locale: Locale = 'en') {
  const name = (key: Parameters<typeof lc>[0]) => lc(key, locale)
  const setupFor = (mood: MoodId, example: boolean): RelightSetup => {
    const masks = example
      ? [newMask('mask-1', lc('relight.mask.subject', locale), 0)]
      : []
    const lights = moodLights(mood, name)
    return {
      lights: example
        ? lights.map((light, index) =>
            index === 0 ? { ...light, mask: masks[0].id } : light
          )
        : lights,
      mood,
      scene: DEFAULT_SCENE,
      masks,
      generation: DEFAULT_GENERATION
    }
  }

  const image = shallowRef<RelightImage>()
  const setup = shallowRef<RelightSetup>(setupFor('sunset', false))
  const past = shallowRef<RelightSetup[]>([])
  const future = shallowRef<RelightSetup[]>([])
  const phase = shallowRef<RelightPhase>({ kind: 'editing' })
  const tray = ref<RelightTray>()
  const view = ref<RelightView>('live')
  const handles = ref(true)
  const selected = ref<string>()
  let lastEdit: string | undefined
  let added = 0
  let ownUrl: string | undefined
  let pendingUrl: string | undefined
  let run: AbortController | undefined

  const lights = computed(() => setup.value.lights)
  const lit = computed(() => lights.value.filter((light) => light.visible))
  const full = computed(() => lights.value.length >= MAX_LIGHTS)
  const canRun = computed(
    () => phase.value.kind !== 'running' && lit.value.length > 0
  )

  function leaveResult(next: RelightPhase) {
    const current = phase.value
    if (
      current.kind === 'done' &&
      current.result.url.startsWith('blob:') &&
      current.result.url !== image.value?.url
    )
      URL.revokeObjectURL(current.result.url)
    phase.value = next
  }

  function reset(next: RelightImage, mood: MoodId) {
    run?.abort()
    leaveResult({ kind: 'editing' })
    image.value = next
    setup.value = setupFor(mood, next.url === RELIGHT_EXAMPLE.url)
    past.value = []
    future.value = []
    lastEdit = undefined
    selected.value = setup.value.lights[0]?.id
    view.value = 'live'
  }

  function releaseOwnUrl() {
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = undefined
  }

  function useExample() {
    pendingUrl = undefined
    reset(RELIGHT_EXAMPLE, 'sunset')
    releaseOwnUrl()
  }

  async function useFile(file: File) {
    const url = URL.createObjectURL(file)
    pendingUrl = url
    const size = await imageSize(url)
    if (pendingUrl !== url || !size) {
      URL.revokeObjectURL(url)
      return
    }
    pendingUrl = undefined
    reset({ url, name: file.name, ...size }, 'studio')
    releaseOwnUrl()
    ownUrl = url
  }

  /**
   * Call before a change the visitor can undo. Changes that share a `key`
   * in a row (one slider dragged, one light nudged) undo as one step.
   */
  function checkpoint(key?: string) {
    if (key && key === lastEdit) return
    lastEdit = key
    past.value = [...past.value, setup.value]
    future.value = []
  }

  function change(next: Partial<RelightSetup>, key?: string) {
    checkpoint(key)
    setup.value = { ...setup.value, ...next }
  }

  const patched = (id: string, patch: Partial<Light>) =>
    lights.value.map((light) =>
      light.id === id ? { ...light, ...patch } : light
    )

  /** Changes one light; pass `key` to fold a run of edits into one undo. */
  function updateLight(id: string, patch: Partial<Light>, key?: string) {
    change({ lights: patched(id, patch) }, key)
  }

  /** Moves a light mid-drag, after `checkpoint()` at the start of it. */
  function place(id: string, x: number, y: number) {
    setup.value = { ...setup.value, lights: patched(id, { x, y }) }
  }

  function nextId() {
    added += 1
    return `light-${added}`
  }

  function addLight(kind: LightKind = 'point') {
    if (full.value) return
    const light = newLight(
      nextId(),
      lc('relight.light.new', locale, { n: lights.value.length + 1 }),
      lights.value.length,
      kind
    )
    change({ lights: [...lights.value, light] })
    selected.value = light.id
  }

  function duplicateLight(id: string) {
    const source = lights.value.find((light) => light.id === id)
    if (!source || full.value) return
    const copy = {
      ...source,
      id: nextId(),
      name: lc('relight.light.copy', locale, { name: source.name }),
      x: Math.min(1, source.x + 0.05),
      y: Math.min(1, source.y + 0.05)
    }
    const at = lights.value.indexOf(source) + 1
    change({
      lights: [...lights.value.slice(0, at), copy, ...lights.value.slice(at)]
    })
    selected.value = copy.id
  }

  function removeLight(id: string) {
    change({ lights: lights.value.filter((light) => light.id !== id) })
    if (selected.value === id) selected.value = lights.value[0]?.id
  }

  function pickMood(mood: MoodId) {
    change({ lights: moodLights(mood, name), mood })
    selected.value = lights.value[0]?.id
  }

  function updateScene(patch: Partial<RelightScene>, key?: string) {
    change({ scene: { ...setup.value.scene, ...patch } }, key)
  }

  function updateGeneration(patch: Partial<RelightGeneration>, key?: string) {
    change({ generation: { ...setup.value.generation, ...patch } }, key)
  }

  /** Mocks segmenting `subject` and keeps the selected light inside it. */
  function addMask(subject: string) {
    const label = subject.trim()
    if (!label) return
    const { masks } = setup.value
    const mask = newMask(`mask-${masks.length + 1}`, label, masks.length)
    change({
      masks: [...masks, mask],
      lights: selected.value
        ? patched(selected.value, { mask: mask.id })
        : lights.value
    })
  }

  function updateMask(id: string, patch: Partial<RelightMask>) {
    change({
      masks: setup.value.masks.map((mask) =>
        mask.id === id ? { ...mask, ...patch } : mask
      )
    })
  }

  function removeMask(id: string) {
    change({
      masks: setup.value.masks.filter((mask) => mask.id !== id),
      lights: lights.value.map((light) =>
        light.mask === id ? { ...light, mask: undefined } : light
      )
    })
  }

  function restore(next: RelightSetup) {
    setup.value = next
    lastEdit = undefined
    if (!next.lights.some((light) => light.id === selected.value))
      selected.value = next.lights[0]?.id
  }

  function undo() {
    const previous = past.value.at(-1)
    if (!previous) return
    future.value = [setup.value, ...future.value]
    past.value = past.value.slice(0, -1)
    restore(previous)
  }

  function redo() {
    const next = future.value.at(0)
    if (!next) return
    past.value = [...past.value, setup.value]
    future.value = future.value.slice(1)
    restore(next)
  }

  async function relight() {
    const current = image.value
    if (!current || !canRun.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    leaveResult({ kind: 'running', startedAt: Date.now() })
    const { masks, scene, generation } = setup.value
    try {
      const result = await runRelight(
        relightRequest(current.url, lights.value, masks, scene, generation),
        controller.signal
      )
      if (run === controller) phase.value = { kind: 'done', result }
      else if (result.url.startsWith('blob:')) URL.revokeObjectURL(result.url)
    } catch {
      if (run === controller && !controller.signal.aborted)
        phase.value = { kind: 'failed' }
    }
  }

  function cancel() {
    run?.abort()
    run = undefined
    phase.value = { kind: 'editing' }
  }

  function edit() {
    leaveResult({ kind: 'editing' })
  }

  function toggleTray(next: RelightTray) {
    tray.value = tray.value === next ? undefined : next
  }

  tryOnScopeDispose(() => {
    run?.abort()
    pendingUrl = undefined
    leaveResult({ kind: 'editing' })
    releaseOwnUrl()
  })

  return {
    image,
    setup,
    lights,
    lit,
    phase,
    tray,
    view,
    handles,
    selected,
    full,
    canRun,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    useExample,
    useFile,
    checkpoint,
    place,
    updateLight,
    addLight,
    duplicateLight,
    removeLight,
    pickMood,
    updateScene,
    updateGeneration,
    addMask,
    updateMask,
    removeMask,
    undo,
    redo,
    relight,
    cancel,
    edit,
    toggleTray
  }
}

export type Relight = ReturnType<typeof useRelight>
