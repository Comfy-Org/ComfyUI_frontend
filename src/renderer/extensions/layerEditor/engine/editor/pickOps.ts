import type { ContentStore } from '../content'
import type { GroupData, RasterData, SceneNode, Vec2 } from '../node'
import { toLocalFrame } from '../tools/transformMath'

export const PICK_OPACITY_THRESHOLD = 0.25

export type AlphaSampler = (
  canvas: HTMLCanvasElement,
  x: number,
  y: number
) => number

function defaultAlphaSampler(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): number {
  let ctx: CanvasRenderingContext2D | null
  try {
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  } catch {
    ctx = null
  }
  if (!ctx) return 1
  try {
    const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)))
    const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)))
    const data = ctx.getImageData(px, py, 1, 1).data
    return (data[3] ?? 255) / 255
  } catch {
    return 1
  }
}

function rasterAlphaAt(
  node: RasterData,
  pt: Vec2,
  content: ContentStore,
  sample: AlphaSampler
): number {
  const t = node.transform
  if (t.w <= 0 || t.h <= 0) return 0
  const local = toLocalFrame(t, pt)
  if (Math.abs(local.x) > t.w / 2 || Math.abs(local.y) > t.h / 2) return 0
  const canvas = content.get(node.contentId)?.canvas
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return 1
  const cx = ((local.x + t.w / 2) / t.w) * canvas.width
  const cy = ((local.y + t.h / 2) / t.h) * canvas.height
  return sample(canvas, cx, cy)
}

function boxAlphaAt(node: SceneNode, pt: Vec2): number {
  const t = node.transform
  if (t.w <= 0 || t.h <= 0) return 0
  const local = toLocalFrame(t, pt)
  return Math.abs(local.x) <= t.w / 2 && Math.abs(local.y) <= t.h / 2 ? 1 : 0
}

export function layerOpacityAt(
  node: SceneNode,
  pt: Vec2,
  content: ContentStore,
  sample: AlphaSampler = defaultAlphaSampler
): number {
  if (!node.visible || node.opacity <= 0) return 0
  switch (node.kind) {
    case 'group': {
      let best = 0
      for (const child of (node as GroupData).children) {
        best = Math.max(best, layerOpacityAt(child, pt, content, sample))
        if (best >= 1) break
      }
      return best * node.opacity
    }
    case 'raster':
      return rasterAlphaAt(node as RasterData, pt, content, sample)
    default:
      return boxAlphaAt(node, pt)
  }
}

export function pickLayerAt(
  layers: readonly SceneNode[],
  pt: Vec2,
  content: ContentStore,
  sample: AlphaSampler = defaultAlphaSampler
): SceneNode | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const node = layers[i]
    if (layerOpacityAt(node, pt, content, sample) > PICK_OPACITY_THRESHOLD)
      return node
  }
  return null
}
