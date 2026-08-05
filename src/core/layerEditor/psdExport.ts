import type { Layer, LayerMaskData, LinkedFile, Psd } from 'ag-psd'

import { getNodeKind, placeBitmap } from 'pentrado/engine'
import type {
  AdjustmentData,
  Compositor,
  ContentEntry,
  ContentStore,
  Document,
  FillData,
  GroupData,
  RasterData,
  Rect,
  RenderNodeCtx,
  SceneNode,
  TextData,
  Transform,
  VectorData
} from 'pentrado/engine'
import {
  PSD_BLEND_MODES,
  adjustmentToPsd,
  alignToPsd,
  fillToVectorContent,
  hexToPsdColor,
  pathToBezierPaths
} from './psdMapping'

export { PSD_BLEND_MODES }

export interface PsdGuides {
  horizontal: number[]
  vertical: number[]
}

export interface PlacedLeaf {
  canvas: HTMLCanvasElement
  left: number
  top: number
}

export interface PsdExportDeps {
  rasterizeLeaf: (node: SceneNode) => PlacedLeaf | null
  maskCanvas: (node: SceneNode) => PlacedLeaf | null
  composite: () => HTMLCanvasElement
  contentCanvas?: (id: string) => HTMLCanvasElement | null
  fontName?: (node: TextData) => string | undefined
  canvasPng?: (canvas: HTMLCanvasElement) => Promise<Uint8Array>
  guides?: PsdGuides
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function makeGuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else out += Math.floor(Math.random() * 16).toString(16)
  }
  return out
}

export function transformCorners(t: Transform): number[] {
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  const pt = (dx: number, dy: number) => [
    cx + dx * cos - dy * sin,
    cy + dx * sin + dy * cos
  ]
  const hw = t.w / 2
  const hh = t.h / 2
  return [...pt(-hw, -hh), ...pt(hw, -hh), ...pt(hw, hh), ...pt(-hw, hh)]
}

function maskData(
  node: SceneNode,
  deps: PsdExportDeps
): LayerMaskData | undefined {
  if (!node.mask) return undefined
  const placed = deps.maskCanvas(node)
  if (!placed) return undefined
  return {
    canvas: placed.canvas,
    left: placed.left,
    top: placed.top,
    right: placed.left + placed.canvas.width,
    bottom: placed.top + placed.canvas.height,
    defaultColor: 0,
    disabled: !node.mask.enabled
  }
}

function rotatedPointMapper(t: Transform) {
  if (!t.rotation) return undefined
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  return (pt: { x: number; y: number }) => {
    const dx = pt.x - cx
    const dy = pt.y - cy
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
  }
}

function applyTextData(
  layer: Layer,
  node: TextData,
  deps: PsdExportDeps
): void {
  const t = node.transform
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  layer.text = {
    text: node.text,
    transform: [cos, sin, -sin, cos, t.x, t.y + node.fontSize],
    shapeType: 'point',
    style: {
      font: { name: deps.fontName?.(node) ?? 'Inter' },
      fontSize: node.fontSize,
      fillColor: hexToPsdColor(node.color),
      autoLeading: false,
      leading: node.lineHeight * node.fontSize,
      tracking:
        node.fontSize > 0
          ? Math.round((node.letterSpacing / node.fontSize) * 1000)
          : 0
    },
    paragraphStyle: { justification: alignToPsd(node.align) }
  }
}

function applyVectorData(layer: Layer, node: VectorData): void {
  const map = rotatedPointMapper(node.transform)
  const fillRule = node.fill?.rule === 'evenodd' ? 'even-odd' : 'non-zero'
  layer.vectorMask = { paths: pathToBezierPaths(node.path, fillRule, map) }
  if (node.fill) {
    layer.vectorFill = { type: 'color', color: hexToPsdColor(node.fill.color) }
  }
  if (node.stroke) {
    layer.vectorStroke = {
      strokeEnabled: true,
      fillEnabled: !!node.fill,
      lineWidth: { units: 'Pixels', value: node.stroke.width },
      lineCapType: node.stroke.cap,
      lineJoinType: node.stroke.join,
      opacity: node.stroke.opacity ?? 1,
      content: { type: 'color', color: hexToPsdColor(node.stroke.color) }
    }
    if (!layer.vectorFill && node.fill === undefined) {
      layer.vectorFill = {
        type: 'color',
        color: hexToPsdColor(node.stroke.color)
      }
    }
  }
}

async function applyPlacedLayer(
  layer: Layer,
  node: RasterData,
  deps: PsdExportDeps,
  linkedFiles: LinkedFile[]
): Promise<void> {
  if (!deps.contentCanvas || !deps.canvasPng) return
  const source = deps.contentCanvas(node.contentId)
  if (!source) return
  let data: Uint8Array
  try {
    data = await deps.canvasPng(source)
  } catch {
    return
  }
  const id = makeGuid()
  const corners = transformCorners(node.transform)
  linkedFiles.push({
    id,
    name: `${node.name || 'layer'}.png`,
    type: 'png ',
    data
  })
  layer.placedLayer = {
    id,
    placed: makeGuid(),
    type: 'raster',
    transform: corners,
    nonAffineTransform: corners,
    width: source.width,
    height: source.height
  }
}

async function buildLayer(
  node: SceneNode,
  deps: PsdExportDeps,
  linkedFiles: LinkedFile[]
): Promise<Layer> {
  const layer: Layer = {
    name: node.name,
    hidden: !node.visible,
    opacity: clamp01(node.opacity),
    blendMode: PSD_BLEND_MODES[node.mode.blend] ?? 'normal',
    mask: maskData(node, deps)
  }
  if (node.kind === 'group') {
    const g = node as GroupData
    if (g.passThrough) layer.blendMode = 'pass through'
    layer.opened = true
    layer.children = []
    for (const child of g.children) {
      layer.children.push(await buildLayer(child, deps, linkedFiles))
    }
    return layer
  }
  if (node.kind === 'adjustment') {
    const adj = adjustmentToPsd(node as AdjustmentData)
    if (adj) layer.adjustment = adj
    return layer
  }
  const placed = deps.rasterizeLeaf(node)
  if (placed) {
    layer.canvas = placed.canvas
    layer.left = placed.left
    layer.top = placed.top
    layer.right = placed.left + placed.canvas.width
    layer.bottom = placed.top + placed.canvas.height
  }
  if (node.kind === 'text') applyTextData(layer, node as TextData, deps)
  else if (node.kind === 'vector') applyVectorData(layer, node as VectorData)
  else if (node.kind === 'fill')
    layer.vectorFill = fillToVectorContent((node as FillData).fill)
  else if (node.kind === 'raster')
    await applyPlacedLayer(layer, node as RasterData, deps, linkedFiles)
  return layer
}

export interface PsdRenderHost {
  document(): Document
  render(): void
  readbackCanvas(): HTMLCanvasElement
}

export interface PsdContentSource {
  get(id: string): ContentEntry | undefined
}

export function leafPlacedBounds(t: Transform, doc: Document): Rect {
  if (!(t.w > 0 && t.h > 0)) return { x: 0, y: 0, w: doc.width, h: doc.height }
  const corners = transformCorners(t)
  const xs = [corners[0], corners[2], corners[4], corners[6]]
  const ys = [corners[1], corners[3], corners[5], corners[7]]
  const x = Math.floor(Math.min(...xs))
  const y = Math.floor(Math.min(...ys))
  return {
    x,
    y,
    w: Math.max(1, Math.ceil(Math.max(...xs)) - x),
    h: Math.max(1, Math.ceil(Math.max(...ys)) - y)
  }
}

export function rasterizeLeafPlaced(
  node: SceneNode,
  doc: Document,
  content: PsdContentSource
): PlacedLeaf | null {
  const bounds = leafPlacedBounds(node.transform, doc)
  let captured: HTMLCanvasElement | null = null
  const ctx: RenderNodeCtx = {
    compositor: null as unknown as Compositor,
    content: content as ContentStore,
    renderChild: () => null,
    placed: (_key, _stamp, bitmap, tf, linear) => {
      captured = placeBitmap(
        bitmap,
        { ...tf, x: tf.x - bounds.x, y: tf.y - bounds.y },
        bounds.w,
        bounds.h
      )
      return captured
        ? { source: captured, rect: bounds, linear: !!linear }
        : null
    },
    region: { x: 0, y: 0, w: bounds.w, h: bounds.h },
    devicePixelRatio: 1
  }
  try {
    getNodeKind(node.kind).renderNode(node, ctx)
  } catch {
    return null
  }
  return captured ? { canvas: captured, left: bounds.x, top: bounds.y } : null
}

export function maskToPlacedCanvas(
  node: SceneNode,
  doc: Document,
  content: PsdContentSource
): PlacedLeaf | null {
  const m = node.mask
  if (!m) return null
  const entry = content.get(m.contentId)
  if (!entry) return null
  const bounds = leafPlacedBounds(node.transform, doc)
  const c = document.createElement('canvas')
  c.width = bounds.w
  c.height = bounds.h
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, bounds.w, bounds.h)
  const tf =
    node.transform.w > 0 && node.transform.h > 0
      ? node.transform
      : { x: 0, y: 0, w: doc.width, h: doc.height, rotation: 0 }
  ctx.translate(tf.x - bounds.x + tf.w / 2, tf.y - bounds.y + tf.h / 2)
  ctx.rotate(tf.rotation)
  ctx.drawImage(entry.canvas, -tf.w / 2, -tf.h / 2, tf.w, tf.h)
  return { canvas: c, left: bounds.x, top: bounds.y }
}

export async function canvasPngBytes(
  canvas: HTMLCanvasElement
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('toBlob null'))),
      'image/png'
    )
  )
  return new Uint8Array(await blob.arrayBuffer())
}

export async function buildPsdFromEditor(
  host: PsdRenderHost,
  content: PsdContentSource,
  opts?: {
    fontName?: (node: TextData) => string | undefined
    guides?: PsdGuides
  }
): Promise<Psd> {
  const doc = host.document()
  host.render()
  return buildPsd(doc, {
    rasterizeLeaf: (n) => rasterizeLeafPlaced(n, doc, content),
    maskCanvas: (n) => maskToPlacedCanvas(n, doc, content),
    composite: () => host.readbackCanvas(),
    contentCanvas: (id) => content.get(id)?.canvas ?? null,
    fontName: opts?.fontName,
    canvasPng: canvasPngBytes,
    guides: opts?.guides
  })
}

export async function buildPsd(
  doc: Document,
  deps: PsdExportDeps
): Promise<Psd> {
  const linkedFiles: LinkedFile[] = []
  const children: Layer[] = []
  for (const node of doc.root.children) {
    children.push(await buildLayer(node, deps, linkedFiles))
  }
  const psd: Psd = {
    width: doc.width,
    height: doc.height,
    canvas: deps.composite(),
    children
  }
  if (linkedFiles.length) psd.linkedFiles = linkedFiles
  if (
    deps.guides &&
    (deps.guides.horizontal.length || deps.guides.vertical.length)
  ) {
    psd.imageResources = {
      gridAndGuidesInformation: {
        guides: [
          ...deps.guides.horizontal.map((location) => ({
            location,
            direction: 'horizontal' as const
          })),
          ...deps.guides.vertical.map((location) => ({
            location,
            direction: 'vertical' as const
          }))
        ]
      }
    }
  }
  return psd
}
