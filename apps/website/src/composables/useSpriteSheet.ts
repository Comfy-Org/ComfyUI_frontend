import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { imageSize } from '../lib/workshop/image-size'
import type {
  SpriteSheetProgress,
  SpriteSheetResult
} from '../lib/workshop/sprite-sheet/contract'
import { spriteSheetRequest } from '../lib/workshop/sprite-sheet/contract'
import {
  SPRITE_EXAMPLE,
  runSpriteSheet
} from '../lib/workshop/sprite-sheet/mock-run'
import type { SpriteSetup } from '../lib/workshop/sprite-sheet/options'
import {
  DEFAULT_SETUP,
  SPRITE_GRID
} from '../lib/workshop/sprite-sheet/options'
import { useSpritePlayback } from './useSpritePlayback'

export interface SpriteImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

type SpritePhase =
  | { readonly kind: 'editing' }
  | {
      readonly kind: 'running'
      readonly startedAt: number
      readonly progress: SpriteSheetProgress
    }
  | { readonly kind: 'done'; readonly result: SpriteSheetResult }
  | { readonly kind: 'failed' }

export type SpriteTray = 'animation' | 'style' | 'motion' | 'seed'
export type SpriteView = 'sheet' | 'preview'

const revocable = (url: string | undefined, keep?: string) =>
  url?.startsWith('blob:') && url !== keep ? url : undefined

/**
 * The Sprite Sheet Generator's page state. The run itself is
 * `runSpriteSheet`, mocked for now.
 */
export function useSpriteSheet() {
  const image = shallowRef<SpriteImage>()
  const setup = shallowRef<SpriteSetup>(DEFAULT_SETUP)
  const past = shallowRef<SpriteSetup[]>([])
  const future = shallowRef<SpriteSetup[]>([])
  const phase = shallowRef<SpritePhase>({ kind: 'editing' })
  const tray = ref<SpriteTray>()
  const view = ref<SpriteView>('sheet')
  let lastEdit: string | undefined
  let ownUrl: string | undefined
  let pendingUrl: string | undefined
  let run: AbortController | undefined

  const frames = computed(() =>
    phase.value.kind === 'done' ? phase.value.result.frames : SPRITE_GRID.frames
  )
  const playback = useSpritePlayback(() => frames.value)
  const canRun = computed(
    () => Boolean(image.value) && phase.value.kind !== 'running'
  )

  function release(url: string | undefined) {
    const own = revocable(url, image.value?.url)
    if (own) URL.revokeObjectURL(own)
  }

  function leaveResult(next: SpritePhase) {
    const current = phase.value
    if (current.kind === 'done') release(current.result.url)
    phase.value = next
  }

  /** Shows `next`, keeping the setup, releasing the previous upload. */
  function adopt(next: SpriteImage, own?: string) {
    pendingUrl = undefined
    run?.abort()
    leaveResult({ kind: 'editing' })
    image.value = next
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = own
  }

  function useExample() {
    adopt(SPRITE_EXAMPLE)
  }

  async function useFile(file: File) {
    if (!file.type.startsWith('image/') || phase.value.kind === 'running')
      return
    const url = URL.createObjectURL(file)
    pendingUrl = url
    const size = await imageSize(url)
    if (pendingUrl === url && size)
      adopt({ url, name: file.name || 'character.png', ...size }, url)
    else URL.revokeObjectURL(url)
  }

  /** Changes the setup; changes sharing a `key` in a row undo as one. */
  function change(patch: Partial<SpriteSetup>, key?: string) {
    if (!key || key !== lastEdit) {
      past.value = [...past.value, setup.value]
      future.value = []
    }
    lastEdit = key
    setup.value = { ...setup.value, ...patch }
  }

  function undo() {
    const previous = past.value.at(-1)
    if (!previous) return
    future.value = [...future.value, setup.value]
    past.value = past.value.slice(0, -1)
    setup.value = previous
    lastEdit = undefined
  }

  function redo() {
    const next = future.value.at(-1)
    if (!next) return
    past.value = [...past.value, setup.value]
    future.value = future.value.slice(0, -1)
    setup.value = next
    lastEdit = undefined
  }

  async function generate() {
    const current = image.value
    if (!current || !canRun.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    const startedAt = Date.now()
    leaveResult({ kind: 'running', startedAt, progress: { stage: 'queued' } })
    try {
      const result = await runSpriteSheet(
        spriteSheetRequest(current.url, setup.value),
        controller.signal,
        {
          onProgress: (progress) => {
            if (run === controller)
              phase.value = { kind: 'running', startedAt, progress }
          }
        }
      )
      if (run !== controller) return release(result.url)
      phase.value = { kind: 'done', result }
      playback.frame.value = 0
    } catch {
      if (run === controller && !controller.signal.aborted)
        phase.value = { kind: 'failed' }
    }
  }

  /** Runs again on the next seed, so the visitor gets another take. */
  function again() {
    change({ seed: setup.value.seed + 1 })
    void generate()
  }

  function cancel() {
    run?.abort()
    run = undefined
    phase.value = { kind: 'editing' }
  }

  function edit() {
    leaveResult({ kind: 'editing' })
  }

  function toggleTray(next: SpriteTray) {
    tray.value = tray.value === next ? undefined : next
  }

  /** Opens the Preview stopped on frame `index`, to look at it. */
  function showFrame(index: number) {
    view.value = 'preview'
    playback.show(index)
  }

  tryOnScopeDispose(() => {
    run?.abort()
    pendingUrl = undefined
    leaveResult({ kind: 'editing' })
    if (ownUrl) URL.revokeObjectURL(ownUrl)
  })

  return {
    image,
    setup,
    phase,
    tray,
    view,
    playback,
    canRun,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    useExample,
    useFile,
    change,
    undo,
    redo,
    generate,
    again,
    cancel,
    edit,
    toggleTray,
    showFrame
  }
}

export type SpriteSheet = ReturnType<typeof useSpriteSheet>
