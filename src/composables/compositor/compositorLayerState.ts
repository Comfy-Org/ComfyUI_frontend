import { LAYER_MODES } from '@/core/layerEditor/engine/mode'
import type { BlendFn } from '@/core/layerEditor/engine/mode'
import type {
  FillData,
  SceneNode,
  Transform
} from '@/core/layerEditor/engine/node'

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
  visible: true
}

export interface CompositorLayerState {
  canvas?: { w: number; h: number }
  inputs?: string[]
  background?: CompositorBackgroundEntry
  layers: Array<CompositorLayerEntry | null>
}

export interface CompositorBBox {
  x: number
  y: number
  width: number
  height: number
  name?: string | null
}

interface CompositorLayerStateInit {
  canvas?: { w: number; h: number }
  background?: CompositorBackgroundEntry
  layers: Array<Partial<CompositorLayerEntry> | null>
}

interface CompositorLayerOps {
  setCanvasSize(w: number, h: number): void
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
  return typeof value === 'string' && value in LAYER_MODES
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
  inputs?: string[]
): CompositorLayerState {
  const background = layers.find(
    (node): node is FillData => node.kind === 'fill'
  )
  return {
    canvas: { w: canvas.w, h: canvas.h },
    ...(inputs ? { inputs } : {}),
    ...(background ? { background: backgroundEntry(background) } : {}),
    layers: layers
      .filter((node) => node.kind !== 'fill')
      .map((node) => {
        const flips = layerFlips(node.id)
        return {
          name: node.name,
          visible: node.visible,
          opacity: node.opacity,
          blend: node.mode.blend,
          transform: { ...node.transform },
          flipH: flips.h,
          flipV: flips.v
        }
      })
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

function parseInputs(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items: unknown[] = value
  return items.every((item): item is string => typeof item === 'string')
    ? items
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

  const { canvas, layers, inputs, background } = raw as Record<string, unknown>
  const canvasSize = parseCanvasSize(canvas)
  const parsedInputs = parseInputs(inputs)
  const parsedBackground = parseBackground(background)

  return {
    ...(canvasSize ? { canvas: canvasSize } : {}),
    ...(parsedInputs ? { inputs: parsedInputs } : {}),
    ...(parsedBackground ? { background: parsedBackground } : {}),
    layers: Array.isArray(layers) ? layers.map(parseEntry) : []
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
  bboxes: ReadonlyArray<CompositorBBox | null> | undefined
): CompositorLayerStateInit | null {
  if (!bboxes?.some((bbox) => bbox !== null)) return null
  return {
    layers: bboxes.map((bbox) =>
      bbox
        ? {
            ...(bbox.name ? { name: bbox.name } : {}),
            transform: {
              x: bbox.x,
              y: bbox.y,
              w: bbox.width,
              h: bbox.height,
              rotation: 0
            }
          }
        : null
    )
  }
}

export function resolveInitialLayerState(
  savedState: CompositorLayerState | null,
  currentInputs: readonly string[] | undefined,
  bboxes: ReadonlyArray<CompositorBBox | null> | undefined
): CompositorLayerStateInit | null {
  if (savedState && layerStateInputsMatch(savedState.inputs, currentInputs))
    return savedState
  return bboxLayerState(bboxes)
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

  const count = Math.min(layers.length, state.layers.length)
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
}
