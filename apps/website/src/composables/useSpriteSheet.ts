import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { imageSize } from '../lib/workshop/image-size'
import type { SpriteSheetResult } from '../lib/workshop/sprite-sheet/mock-run'
import {
  SPRITE_EXAMPLE,
  runSpriteSheet,
  spriteSheetRequest
} from '../lib/workshop/sprite-sheet/mock-run'
import type { SpriteSetup } from '../lib/workshop/sprite-sheet/options'
import { DEFAULT_SETUP } from '../lib/workshop/sprite-sheet/options'
import { renderSpriteSheet } from '../lib/workshop/sprite-sheet/render-sheet'
import { useSpritePlayback } from './useSpritePlayback'

export interface SpriteImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

type SpritePhase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'running'; readonly startedAt: number }
  | { readonly kind: 'done'; readonly result: SpriteSheetResult }
  | { readonly kind: 'failed' }

export type SpriteTray = 'style' | 'motion' | 'advanced'

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
  const compare = ref(false)
  const source = ref<string>()
  let lastEdit: string | undefined
  let ownUrl: string | undefined
  let pendingUrl: string | undefined
  let run: AbortController | undefined

  const frames = computed(() =>
    phase.value.kind === 'done' ? phase.value.result.frames : setup.value.frames
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
    release(source.value)
    source.value = undefined
    compare.value = false
    phase.value = next
  }

  function reset(next: SpriteImage) {
    run?.abort()
    leaveResult({ kind: 'editing' })
    image.value = next
    setup.value = DEFAULT_SETUP
    past.value = []
    future.value = []
    lastEdit = undefined
  }

  /** Shows `next`, releasing the visitor's previous upload. */
  function adopt(next: SpriteImage, own?: string) {
    pendingUrl = undefined
    reset(next)
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = own
  }

  function useExample() {
    adopt(SPRITE_EXAMPLE)
  }

  async function useFile(file: File) {
    const url = URL.createObjectURL(file)
    pendingUrl = url
    const size = await imageSize(url)
    if (pendingUrl === url && size)
      adopt({ url, name: file.name, ...size }, url)
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

  async function showSource(url: string, current: SpriteSetup) {
    const plain = await renderSpriteSheet(url, current, true).catch(
      () => undefined
    )
    if (phase.value.kind === 'done' && image.value?.url === url)
      source.value = plain ?? url
    else release(plain)
  }

  async function generate() {
    const current = image.value
    if (!current || !canRun.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    leaveResult({ kind: 'running', startedAt: Date.now() })
    const sent = setup.value
    try {
      const result = await runSpriteSheet(
        spriteSheetRequest(current.url, sent),
        controller.signal
      )
      if (run !== controller) return release(result.url)
      phase.value = { kind: 'done', result }
      playback.frame.value = 0
      void showSource(current.url, sent)
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
    compare,
    source,
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
    toggleTray
  }
}

export type SpriteSheet = ReturnType<typeof useSpriteSheet>
