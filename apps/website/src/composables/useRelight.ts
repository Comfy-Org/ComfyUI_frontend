import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { Locale } from '../i18n/translations'
import { imageSize } from '../lib/workshop/image-size'
import { lc } from '../lib/workshop/relight/copy'
import type {
  Light,
  MoodId,
  RelightScene
} from '../lib/workshop/relight/lights'
import {
  DEFAULT_SCENE,
  MAX_LIGHTS,
  moodLights,
  newLight
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
}

type RelightPhase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'running' }
  | { readonly kind: 'done'; readonly result: RelightResult }
  | { readonly kind: 'failed' }

export type RelightTray = 'lights' | 'mood' | 'scene'

/** Relight's page state. The run itself is `runRelight`, mocked for now. */
export function useRelight(locale: Locale = 'en') {
  const name = (key: Parameters<typeof lc>[0]) => lc(key, locale)
  const setupFor = (mood: MoodId): RelightSetup => ({
    lights: moodLights(mood, name),
    mood,
    scene: DEFAULT_SCENE
  })

  const image = shallowRef<RelightImage>()
  const setup = shallowRef<RelightSetup>(setupFor('sunset'))
  const past = shallowRef<RelightSetup[]>([])
  const future = shallowRef<RelightSetup[]>([])
  const phase = shallowRef<RelightPhase>({ kind: 'editing' })
  const tray = ref<RelightTray>()
  const preview = ref(true)
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

  function reset(next: RelightImage, mood: MoodId) {
    run?.abort()
    image.value = next
    setup.value = setupFor(mood)
    past.value = []
    future.value = []
    lastEdit = undefined
    selected.value = setup.value.lights[0]?.id
    preview.value = true
    phase.value = { kind: 'editing' }
  }

  function releaseOwnUrl() {
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = undefined
  }

  function useExample() {
    pendingUrl = undefined
    releaseOwnUrl()
    reset(RELIGHT_EXAMPLE, 'sunset')
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
    releaseOwnUrl()
    ownUrl = url
    reset({ url, name: file.name, ...size }, 'studio')
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

  /** Changes one light; pass `key` to fold a run of edits into one undo. */
  function updateLight(id: string, patch: Partial<Light>, key?: string) {
    change(
      {
        lights: lights.value.map((light) =>
          light.id === id ? { ...light, ...patch } : light
        )
      },
      key
    )
  }

  /** Moves a light mid-drag, after `checkpoint()` at the start of it. */
  function place(id: string, x: number, y: number) {
    setup.value = {
      ...setup.value,
      lights: lights.value.map((light) =>
        light.id === id ? { ...light, x, y } : light
      )
    }
  }

  function addLight() {
    if (full.value) return
    added += 1
    const light = newLight(
      `light-${added}`,
      lc('relight.light.new', locale, { n: lights.value.length + 1 }),
      lights.value.length
    )
    change({ lights: [...lights.value, light] })
    selected.value = light.id
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
    phase.value = { kind: 'running' }
    try {
      const result = await runRelight(
        relightRequest(current.url, lights.value, setup.value.scene),
        controller.signal
      )
      if (run === controller) phase.value = { kind: 'done', result }
    } catch {
      if (run === controller && !controller.signal.aborted)
        phase.value = { kind: 'failed' }
    }
  }

  function cancel() {
    run?.abort()
    phase.value = { kind: 'editing' }
  }

  function edit() {
    phase.value = { kind: 'editing' }
  }

  function toggleTray(next: RelightTray) {
    tray.value = tray.value === next ? undefined : next
  }

  tryOnScopeDispose(() => {
    run?.abort()
    pendingUrl = undefined
    releaseOwnUrl()
  })

  return {
    image,
    setup,
    lights,
    lit,
    phase,
    tray,
    preview,
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
    removeLight,
    pickMood,
    updateScene,
    undo,
    redo,
    relight,
    cancel,
    edit,
    toggleTray
  }
}

export type Relight = ReturnType<typeof useRelight>
