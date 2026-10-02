import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { Locale } from '../i18n/translations'
import { imageSize } from '../lib/workshop/image-size'
import type { MoveObject, Rect } from '../lib/workshop/move-anything/arrange'
import { MAX_OBJECTS, isMoved } from '../lib/workshop/move-anything/arrange'
import { mc } from '../lib/workshop/move-anything/copy'
import type { KnownShape } from '../lib/workshop/move-anything/shapes'
import {
  EXAMPLE_SHAPES,
  blobAround,
  boundsOf,
  outlinePath,
  roundedBoxPath,
  shapeAt,
  shapeForBox
} from '../lib/workshop/move-anything/shapes'
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

type MovePhase =
  | { readonly kind: 'arranging' }
  | { readonly kind: 'moving' }
  | { readonly kind: 'done'; readonly result: MoveResult }
  | { readonly kind: 'failed' }

export type MoveTool = 'move' | 'smart' | 'box'
export type MoveTray = 'objects'
export type MoveView = 'compare' | 'result' | 'original'

type StagePoint = { readonly x: number; readonly y: number }

const DETECT_MS = 500
const SCAN_MS = 700

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
  const seed = ref(42)
  const prompt = ref('')
  const selected = ref<string>()
  const detecting = shallowRef<readonly StagePoint[]>()
  let detect: ReturnType<typeof setTimeout> | undefined
  let ownUrl: string | undefined
  let pendingUrl: string | undefined
  let run: AbortController | undefined

  const moved = computed(() => objects.value.filter(isMoved))
  const canGenerate = computed(
    () => phase.value.kind !== 'moving' && moved.value.length > 0
  )
  const full = computed(() => objects.value.length >= MAX_OBJECTS)

  function reset(next: MoveImage) {
    run?.abort()
    clearTimeout(detect)
    detecting.value = undefined
    image.value = next
    objects.value = []
    past.value = []
    future.value = []
    selected.value = undefined
    tool.value = 'smart'
    phase.value = { kind: 'arranging' }
  }

  function releaseOwnUrl() {
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = undefined
  }

  function useExample() {
    pendingUrl = undefined
    releaseOwnUrl()
    reset(MOVE_EXAMPLE)
    scanExample()
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
    reset({ url, name: file.name, ...size })
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

  const knownShapes = () =>
    image.value?.url === MOVE_EXAMPLE.url ? EXAMPLE_SHAPES : []
  const aspect = () =>
    image.value ? image.value.width / image.value.height : 1

  function addOutline(from: Rect, path: string, label?: string) {
    const existing = objects.value.find((object) => object.mask?.path === path)
    if (existing) {
      selected.value = existing.id
      tool.value = 'move'
      return
    }
    if (full.value) return
    checkpoint()
    const id = `o${Date.now()}`
    const n = objects.value.length + 1
    objects.value = [
      ...objects.value,
      {
        id,
        label: label ?? mc('move.object.label', locale, { n }),
        from,
        to: from,
        mask: { path }
      }
    ]
    selected.value = id
    tool.value = 'move'
  }

  function addShape(shape: KnownShape) {
    addOutline(
      boundsOf(shape.points),
      outlinePath(shape.points),
      mc(shape.label, locale)
    )
  }

  const detected = (shape: KnownShape, i: number): MoveObject => {
    const from = boundsOf(shape.points)
    return {
      id: `d${i}`,
      label: mc(shape.label, locale),
      from,
      to: from,
      mask: { path: outlinePath(shape.points) }
    }
  }

  /** Mocks detecting every known thing in the example, as its starting state. */
  function scanExample() {
    detecting.value = EXAMPLE_SHAPES.map(({ points }) => {
      const { x, y, w, h } = boundsOf(points)
      return { x: x + w / 2, y: y + h / 2 }
    })
    detect = setTimeout(() => {
      detecting.value = undefined
      objects.value = EXAMPLE_SHAPES.map(detected)
      tool.value = 'move'
    }, SCAN_MS)
  }

  /** Mocks detecting the thing under a click, then outlines and adds it. */
  function smartSelect(point: StagePoint) {
    if (full.value || detecting.value) return
    detecting.value = [point]
    detect = setTimeout(() => {
      detecting.value = undefined
      const at = [point.x, point.y] as const
      const shape = shapeAt(knownShapes(), at)
      if (shape) addShape(shape)
      else {
        const blob = blobAround(at, aspect())
        addOutline(boundsOf(blob), outlinePath(blob))
      }
    }, DETECT_MS)
  }

  /** Adds the thing inside a drawn box, snapped to a known outline if one fits. */
  function boxSelect(box: Rect) {
    if (detecting.value) return
    const shape = shapeForBox(knownShapes(), box)
    if (shape) addShape(shape)
    else addOutline(box, roundedBoxPath(box, aspect()))
  }

  function rename(id: string, label: string) {
    const name = label.trim()
    const current = objects.value.find((object) => object.id === id)
    if (!current || !name || name === current.label) return
    checkpoint()
    objects.value = objects.value.map((object) =>
      object.id === id ? { ...object, label: name } : object
    )
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
        {
          imageUrl: current.url,
          objects: moved.value,
          quality: quality.value,
          seed: seed.value,
          prompt: prompt.value
        },
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
    clearTimeout(detect)
    run?.abort()
    pendingUrl = undefined
    releaseOwnUrl()
  })

  return {
    image,
    objects,
    phase,
    tool,
    tray,
    quality,
    seed,
    prompt,
    selected,
    detecting,
    moved,
    full,
    canGenerate,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    useExample,
    useFile,
    checkpoint,
    place,
    smartSelect,
    boxSelect,
    rename,
    remove,
    undo,
    redo,
    generate,
    cancel,
    edit,
    toggleTray
  }
}
