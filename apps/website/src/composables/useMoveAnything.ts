import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { Locale } from '../i18n/translations'
import type { MoveObject, Rect } from '../lib/workshop/move-anything/arrange'
import { MAX_OBJECTS, isMoved } from '../lib/workshop/move-anything/arrange'
import { mc } from '../lib/workshop/move-anything/copy'
import type {
  MoveQuality,
  MoveResult
} from '../lib/workshop/move-anything/mock-run'
import { MOVE_EXAMPLE, runMove } from '../lib/workshop/move-anything/mock-run'

export interface MoveImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

export type MovePhase =
  | { readonly kind: 'arranging' }
  | { readonly kind: 'moving' }
  | { readonly kind: 'done'; readonly result: MoveResult }
  | { readonly kind: 'failed' }

export type MoveTool = 'move' | 'add'
export type MoveTray = 'objects' | 'quality'
export type MoveView = 'compare' | 'result' | 'original'

function exampleObjects(locale: Locale): MoveObject[] {
  const kitten = mc('move.example.kitten', locale)
  const succulent = mc('move.example.succulent', locale)
  return [
    { id: 'o1', label: kitten, from: { x: 0.02, y: 0.2, w: 0.31, h: 0.68 } },
    {
      id: 'o2',
      label: succulent,
      from: { x: 0.28, y: 0.54, w: 0.14, h: 0.23 }
    },
    { id: 'o3', label: succulent, from: { x: 0.41, y: 0.56, w: 0.13, h: 0.18 } }
  ].map((object) => ({ ...object, to: object.from }))
}

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = url
  })
}

/** Move anything's page state. The run itself is `runMove`, mocked for now. */
export function useMoveAnything(locale: Locale = 'en') {
  const image = shallowRef<MoveImage>()
  const objects = ref<MoveObject[]>([])
  const past = shallowRef<MoveObject[][]>([])
  const future = shallowRef<MoveObject[][]>([])
  const phase = shallowRef<MovePhase>({ kind: 'arranging' })
  const tool = ref<MoveTool>('move')
  const tray = ref<MoveTray>()
  const quality = ref<MoveQuality>('fast')
  const selected = ref<string>()
  let ownUrl: string | undefined
  let run: AbortController | undefined

  const moved = computed(() => objects.value.filter(isMoved))
  const canGenerate = computed(
    () => phase.value.kind !== 'moving' && moved.value.length > 0
  )
  const full = computed(() => objects.value.length >= MAX_OBJECTS)

  function reset(next: MoveImage, start: MoveObject[]) {
    run?.abort()
    image.value = next
    objects.value = start
    past.value = []
    future.value = []
    selected.value = start[0]?.id
    tool.value = start.length ? 'move' : 'add'
    phase.value = { kind: 'arranging' }
  }

  function releaseOwnUrl() {
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = undefined
  }

  function useExample() {
    releaseOwnUrl()
    reset(MOVE_EXAMPLE, exampleObjects(locale))
  }

  async function useFile(file: File) {
    releaseOwnUrl()
    const url = URL.createObjectURL(file)
    ownUrl = url
    const size = await imageSize(url)
    if (ownUrl !== url) return
    reset({ url, name: file.name, ...size }, [])
  }

  /** Call before a change the visitor can undo. */
  function checkpoint() {
    past.value = [...past.value, objects.value]
    future.value = []
  }

  function place(id: string, to: Rect) {
    objects.value = objects.value.map((object) =>
      object.id === id ? { ...object, to } : object
    )
  }

  function add(from: Rect) {
    if (full.value) return
    checkpoint()
    const n = objects.value.length + 1
    const id = `o${Date.now()}`
    objects.value = [
      ...objects.value,
      { id, label: mc('move.object.label', locale, { n }), from, to: from }
    ]
    selected.value = id
    tool.value = 'move'
  }

  function remove(id: string) {
    checkpoint()
    objects.value = objects.value.filter((object) => object.id !== id)
    if (selected.value === id) selected.value = objects.value[0]?.id
  }

  function undo() {
    const previous = past.value.at(-1)
    if (!previous) return
    future.value = [objects.value, ...future.value]
    past.value = past.value.slice(0, -1)
    objects.value = previous
  }

  function redo() {
    if (!future.value.length) return
    const [next, ...rest] = future.value
    past.value = [...past.value, objects.value]
    future.value = rest
    objects.value = next
  }

  async function generate() {
    const current = image.value
    if (!current || !canGenerate.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    phase.value = { kind: 'moving' }
    try {
      const result = await runMove(
        { imageUrl: current.url, objects: moved.value, quality: quality.value },
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
    phase.value = { kind: 'arranging' }
  }

  function edit() {
    phase.value = { kind: 'arranging' }
  }

  function toggleTray(next: MoveTray) {
    tray.value = tray.value === next ? undefined : next
  }

  tryOnScopeDispose(() => {
    run?.abort()
    releaseOwnUrl()
  })

  return {
    image,
    objects,
    phase,
    tool,
    tray,
    quality,
    selected,
    moved,
    full,
    canGenerate,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    useExample,
    useFile,
    checkpoint,
    place,
    add,
    remove,
    undo,
    redo,
    generate,
    cancel,
    edit,
    toggleTray
  }
}
