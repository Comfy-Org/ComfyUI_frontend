import { LAYER_MODES } from '@/renderer/extensions/layerEditor/engine/mode'
import type { BlendFn } from '@/renderer/extensions/layerEditor/engine/mode'
import type {
  FillData,
  SceneNode,
  Transform
} from '@/renderer/extensions/layerEditor/engine/node'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

interface CompositorLayerEntry {
  name: string
  visible: boolean
  opacity: number
  blend: BlendFn
  transform: Transform
  flipH: boolean
  flipV: boolean
}

interface CompositorBackgroundEntry {
  color: string
  opacity: number
  visible: boolean
}

const DEFAULT_BACKGROUND_ENTRY: CompositorBackgroundEntry = {
  color: '#ffffff',
  opacity: 1,
  visible: false
}

const LAYER_STATE_VERSION = 1

export interface CompositorLayerState {
  version?: typeof LAYER_STATE_VERSION
  canvas?: { w: number; h: number }
  inputs?: string[]
  background?: CompositorBackgroundEntry
  order?: number[]
  layers: Array<CompositorLayerEntry | null>
}

export interface CompositorBBox {
  x: number
  y: number
  width: number
  height: number
  name?: string | null
  rotation?: number
  visible?: boolean
  opacity?: number
  blend?: string
  flipH?: boolean
  flipV?: boolean
}

interface CompositorLayerStateInit {
  canvas?: { w: number; h: number }
  background?: CompositorBackgroundEntry
  order?: number[]
  layers: Array<Partial<CompositorLayerEntry> | null>
}

interface CompositorLayerOps {
  setCanvasSize(w: number, h: number): void
  setLayerOrder(ids: string[]): void
  setBackgroundColor(hex: string): void
  setBackgroundOpacity(value: number): void
  setBackgroundVisible(visible: boolean): void
  renameLayer(id: string, name: string): void
  toggleVisible(id: string): void
  setOpacity(id: string, value: number): void
  setBlendMode(id: string, blend: BlendFn): void
  flipLayer(id: string, axis: 'h' | 'v'): void
  setLayerPosition(id: string, x?: number, y?: number): void
  setLayerDimensions(id: string, w?: number, h?: number): void
  setLayerRotationDeg(id: string, deg: number): void
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBlendFn(value: unknown): value is BlendFn {
  return typeof value === 'string' && Object.hasOwn(LAYER_MODES, value)
}

function parseTransform(value: unknown): Transform | null {
  if (typeof value !== 'object' || value === null) return null
  const { x, y, w, h, rotation } = value as Record<string, unknown>
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(w) ||
    !isFiniteNumber(h) ||
    !isFiniteNumber(rotation)
  )
    return null
  return { x, y, w, h, rotation }
}

function parseFlip(value: unknown): boolean | null {
  if (value === undefined) return false
  return typeof value === 'boolean' ? value : null
}

function parseEntry(value: unknown): CompositorLayerEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const { name, visible, opacity, blend, transform, flipH, flipV } =
    value as Record<string, unknown>
  const parsedTransform = parseTransform(transform)
  const parsedFlipH = parseFlip(flipH)
  const parsedFlipV = parseFlip(flipV)
  if (
    typeof name !== 'string' ||
    typeof visible !== 'boolean' ||
    !isFiniteNumber(opacity) ||
    !isBlendFn(blend) ||
    !parsedTransform ||
    parsedFlipH === null ||
    parsedFlipV === null
  )
    return null
  return {
    name,
    visible,
    opacity,
    blend,
    transform: parsedTransform,
    flipH: parsedFlipH,
    flipV: parsedFlipV
  }
}

function backgroundEntry(node: FillData): CompositorBackgroundEntry {
  return {
    color:
      node.fill.type === 'solid'
        ? node.fill.color
        : DEFAULT_BACKGROUND_ENTRY.color,
    opacity: node.opacity,
    visible: node.visible
  }
}

export function extractLayerState(
  canvas: { w: number; h: number },
  layers: readonly SceneNode[],
  layerFlips: (id: string) => { h: boolean; v: boolean },
  inputs?: string[],
  inputOrder?: readonly string[]
): CompositorLayerState {
  const background = layers.find(
    (node): node is FillData => node.kind === 'fill'
  )
  const imageNodes = layers.filter((node) => node.kind !== 'fill')
  const orderIds = inputOrder ?? imageNodes.map((node) => node.id)
  const inputIndex = new Map(orderIds.map((id, index) => [id, index]))
  const entries: Array<CompositorLayerEntry | null> = orderIds.map(() => null)
  const order: number[] = []
  for (const node of imageNodes) {
    const index = inputIndex.get(node.id)
    if (index === undefined) continue
    const flips = layerFlips(node.id)
    entries[index] = {
      name: node.name,
      visible: node.visible,
      opacity: node.opacity,
      blend: node.mode.blend,
      transform: { ...node.transform },
      flipH: flips.h,
      flipV: flips.v
    }
    order.push(index)
  }
  const identityOrder =
    order.length === entries.length &&
    order.every((value, index) => value === index)
  return {
    version: LAYER_STATE_VERSION,
    canvas: { w: canvas.w, h: canvas.h },
    ...(inputs ? { inputs } : {}),
    ...(background ? { background: backgroundEntry(background) } : {}),
    ...(identityOrder ? {} : { order }),
    layers: entries
  }
}

function parseCanvasSize(value: unknown): { w: number; h: number } | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { w, h } = value as Record<string, unknown>
  return isFiniteNumber(w) && isFiniteNumber(h) ? { w, h } : undefined
}

function parseBackground(
  value: unknown
): CompositorBackgroundEntry | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { color, opacity, visible } = value as Record<string, unknown>
  return {
    color:
      typeof color === 'string' && HEX_COLOR_RE.test(color)
        ? color
        : DEFAULT_BACKGROUND_ENTRY.color,
    opacity: isFiniteNumber(opacity)
      ? Math.max(0, Math.min(1, opacity))
      : DEFAULT_BACKGROUND_ENTRY.opacity,
    visible:
      typeof visible === 'boolean' ? visible : DEFAULT_BACKGROUND_ENTRY.visible
  }
}

function parseOrder(value: unknown, layerCount: number): number[] | undefined {
  if (!Array.isArray(value) || value.length !== layerCount || layerCount === 0)
    return undefined
  const items: unknown[] = value
  if (
    !items.every(
      (item): item is number =>
        typeof item === 'number' &&
        Number.isInteger(item) &&
        item >= 0 &&
        item < layerCount
    )
  )
    return undefined
  return new Set(items).size === layerCount ? [...items] : undefined
}

function parseInputs(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items: unknown[] = value
  return items.every((item): item is string => typeof item === 'string')
    ? [...items]
    : undefined
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function parseLayerState(value: unknown): CompositorLayerState | null {
  const raw = typeof value === 'string' ? parseJson(value) : value
  if (typeof raw !== 'object' || raw === null) return null
  if (Object.keys(raw).length === 0) return null

  const { version, canvas, layers, inputs, background, order } = raw as Record<
    string,
    unknown
  >
  if (version !== undefined && version !== LAYER_STATE_VERSION) return null
  const canvasSize = parseCanvasSize(canvas)
  const parsedInputs = parseInputs(inputs)
  const parsedBackground = parseBackground(background)
  const parsedLayers = Array.isArray(layers) ? layers.map(parseEntry) : []
  const parsedOrder = parseOrder(order, parsedLayers.length)

  return {
    version: LAYER_STATE_VERSION,
    ...(canvasSize ? { canvas: canvasSize } : {}),
    ...(parsedInputs ? { inputs: parsedInputs } : {}),
    ...(parsedBackground ? { background: parsedBackground } : {}),
    ...(parsedOrder ? { order: parsedOrder } : {}),
    layers: parsedLayers
  }
}

export function layerStateInputsMatch(
  saved: readonly string[] | undefined,
  current: readonly string[] | undefined
): boolean {
  if (!saved || !current) return false
  return (
    saved.length === current.length &&
    saved.every((value, index) => value === current[index])
  )
}

function bboxLayerState(
  bboxes: ReadonlyArray<CompositorBBox | null> | undefined,
  canvas?: { w: number; h: number }
): CompositorLayerStateInit | null {
  if (!bboxes?.some((bbox) => bbox !== null)) return null
  const canvasSize = parseCanvasSize(canvas)
  return {
    ...(canvasSize ? { canvas: canvasSize } : {}),
    layers: bboxes.map((bbox) =>
      bbox
        ? {
            ...(typeof bbox.name === 'string' && bbox.name
              ? { name: bbox.name }
              : {}),
            ...(typeof bbox.visible === 'boolean'
              ? { visible: bbox.visible }
              : {}),
            ...(isFiniteNumber(bbox.opacity) ? { opacity: bbox.opacity } : {}),
            ...(isBlendFn(bbox.blend) ? { blend: bbox.blend } : {}),
            ...(bbox.flipH === true ? { flipH: true } : {}),
            ...(bbox.flipV === true ? { flipV: true } : {}),
            transform: {
              x: bbox.x,
              y: bbox.y,
              w: bbox.width,
              h: bbox.height,
              rotation: isFiniteNumber(bbox.rotation) ? bbox.rotation : 0
            }
          }
        : null
    )
  }
}

export function resolveInitialLayerState(
  savedState: CompositorLayerState | null,
  currentInputs: readonly string[] | undefined,
  bboxes: ReadonlyArray<CompositorBBox | null> | undefined,
  canvas?: { w: number; h: number }
): CompositorLayerStateInit | null {
  if (savedState && layerStateInputsMatch(savedState.inputs, currentInputs))
    return savedState
  return bboxLayerState(bboxes, canvas)
}

export function applyLayerState(
  state: CompositorLayerStateInit,
  layers: ReadonlyArray<{ id: string; visible: boolean }>,
  ops: CompositorLayerOps
): void {
  if (state.canvas) ops.setCanvasSize(state.canvas.w, state.canvas.h)

  const background = state.background ?? DEFAULT_BACKGROUND_ENTRY
  ops.setBackgroundColor(background.color)
  ops.setBackgroundOpacity(background.opacity)
  ops.setBackgroundVisible(background.visible)

  if (state.layers.length !== layers.length) return
  const count = layers.length
  for (let i = 0; i < count; i++) {
    const entry = state.layers[i]
    if (!entry) continue
    const { id, visible } = layers[i]
    if (entry.name !== undefined) ops.renameLayer(id, entry.name)
    if (entry.visible !== undefined && visible !== entry.visible)
      ops.toggleVisible(id)
    if (entry.opacity !== undefined) ops.setOpacity(id, entry.opacity)
    if (entry.blend !== undefined) ops.setBlendMode(id, entry.blend)
    if (entry.flipH) ops.flipLayer(id, 'h')
    if (entry.flipV) ops.flipLayer(id, 'v')
    if (entry.transform) {
      ops.setLayerPosition(id, entry.transform.x, entry.transform.y)
      ops.setLayerDimensions(id, entry.transform.w, entry.transform.h)
      ops.setLayerRotationDeg(id, (entry.transform.rotation * 180) / Math.PI)
    }
  }

  if (state.order) {
    const ids = state.order
      .map((index) => layers[index]?.id)
      .filter((id): id is string => id !== undefined)
    if (ids.length > 0) ops.setLayerOrder(ids)
  }
}
