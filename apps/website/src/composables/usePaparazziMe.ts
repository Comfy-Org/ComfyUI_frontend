import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { imageSize } from '../lib/workshop/image-size'
import type { PaparazziResult } from '../lib/workshop/paparazzi-me/contract'
import { paparazziRequest } from '../lib/workshop/paparazzi-me/contract'
import {
  PAPARAZZI_EXAMPLE,
  runPaparazzi
} from '../lib/workshop/paparazzi-me/mock-run'
import type {
  PaparazziSetup,
  SceneId
} from '../lib/workshop/paparazzi-me/setup'
import {
  DEFAULT_SETUP,
  hasCelebrity,
  nextSeed
} from '../lib/workshop/paparazzi-me/setup'

export interface PaparazziFace {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

type PaparazziPhase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'running'; readonly startedAt: number }
  | { readonly kind: 'done'; readonly result: PaparazziResult }
  | { readonly kind: 'failed' }

export type PaparazziTray = 'star' | 'scene' | 'resolution' | 'advanced'

/**
 * Paparazzi me's page state, opened on the worked example so it demos at
 * once. The run itself is `runPaparazzi`, mocked for now.
 */
export function usePaparazziMe() {
  const face = shallowRef<PaparazziFace | undefined>(PAPARAZZI_EXAMPLE)
  const setup = shallowRef<PaparazziSetup>(DEFAULT_SETUP)
  const past = shallowRef<PaparazziSetup[]>([])
  const future = shallowRef<PaparazziSetup[]>([])
  const phase = shallowRef<PaparazziPhase>({ kind: 'editing' })
  const tray = ref<PaparazziTray>()
  const compare = ref(false)
  const touched = ref(false)
  let lastEdit: string | undefined
  let ownUrl: string | undefined
  let pendingUrl: string | undefined
  let run: AbortController | undefined

  const canRun = computed(
    () =>
      phase.value.kind !== 'running' &&
      Boolean(face.value) &&
      hasCelebrity(setup.value)
  )

  function leaveResult(next: PaparazziPhase) {
    const current = phase.value
    if (current.kind === 'done' && current.result.url.startsWith('blob:'))
      URL.revokeObjectURL(current.result.url)
    phase.value = next
  }

  function releaseOwnUrl() {
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = undefined
  }

  function showFace(next: PaparazziFace | undefined) {
    run?.abort()
    leaveResult({ kind: 'editing' })
    face.value = next
    touched.value = true
  }

  function useExample() {
    pendingUrl = undefined
    showFace(PAPARAZZI_EXAMPLE)
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
    showFace({ url, name: file.name, ...size })
    releaseOwnUrl()
    ownUrl = url
  }

  function removeFace() {
    pendingUrl = undefined
    showFace(undefined)
    releaseOwnUrl()
  }

  /** Changes the setup; edits that share a `key` in a row undo as one. */
  function change(patch: Partial<PaparazziSetup>, key?: string) {
    touched.value = true
    if (!key || key !== lastEdit) {
      past.value = [...past.value, setup.value]
      future.value = []
    }
    lastEdit = key
    setup.value = { ...setup.value, ...patch }
  }

  function pickScene(scene: SceneId) {
    change({ scene, sceneOverride: '' })
  }

  function shuffle() {
    change({ seed: nextSeed(setup.value.seed) })
  }

  function undo() {
    const previous = past.value.at(-1)
    if (!previous) return
    future.value = [setup.value, ...future.value]
    past.value = past.value.slice(0, -1)
    setup.value = previous
    lastEdit = undefined
  }

  function redo() {
    const next = future.value.at(0)
    if (!next) return
    past.value = [...past.value, setup.value]
    future.value = future.value.slice(1)
    setup.value = next
    lastEdit = undefined
  }

  async function snap() {
    const current = face.value
    if (!current || !canRun.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    leaveResult({ kind: 'running', startedAt: Date.now() })
    try {
      const result = await runPaparazzi(
        paparazziRequest(current.url, setup.value),
        controller.signal
      )
      if (run === controller) {
        compare.value = false
        phase.value = { kind: 'done', result }
      } else if (result.url.startsWith('blob:')) URL.revokeObjectURL(result.url)
    } catch {
      if (run === controller && !controller.signal.aborted)
        phase.value = { kind: 'failed' }
    }
  }

  /** Another take: the next seed, run straight away. */
  function retry() {
    shuffle()
    void snap()
  }

  function cancel() {
    run?.abort()
    run = undefined
    phase.value = { kind: 'editing' }
  }

  function edit() {
    leaveResult({ kind: 'editing' })
  }

  function toggleTray(next: PaparazziTray) {
    tray.value = tray.value === next ? undefined : next
  }

  tryOnScopeDispose(() => {
    run?.abort()
    pendingUrl = undefined
    leaveResult({ kind: 'editing' })
    releaseOwnUrl()
  })

  return {
    face,
    setup,
    phase,
    tray,
    compare,
    touched,
    canRun,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    useExample,
    useFile,
    removeFace,
    change,
    pickScene,
    shuffle,
    undo,
    redo,
    snap,
    retry,
    cancel,
    edit,
    toggleTray
  }
}

export type PaparazziMe = ReturnType<typeof usePaparazziMe>
