import type { NodeTexture } from '../compositor'
import {
  cloneFillSpec,
  defaultFillSpec,
  fillSpecStamp,
  normalizeFillSpec,
  renderFillBitmap
} from '../fill'
import { generateId } from '../id'
import { defaultMode } from '../mode'
import type { FillData, Rect } from '../node'
import type { NodeKind, RenderNodeCtx } from '../nodeKind'
import { normalizeLayerFx } from '../render/layerFx'

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && isFinite(v) ? v : d
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean): boolean =>
  typeof v === 'boolean' ? v : d

const bitmapCache = new Map<
  string,
  { stamp: string; canvas: HTMLCanvasElement | null }
>()

export function fillBitmap(
  node: FillData,
  w: number,
  h: number
): HTMLCanvasElement | null {
  const stamp = `${fillSpecStamp(node.fill)}|${w}x${h}`
  const hit = bitmapCache.get(node.id)
  if (hit && hit.stamp === stamp) return hit.canvas
  if (bitmapCache.size > 64) {
    const first = bitmapCache.keys().next().value
    if (first !== undefined) bitmapCache.delete(first)
  }
  const canvas = renderFillBitmap(node.fill, w, h)
  bitmapCache.set(node.id, { stamp, canvas })
  return canvas
}

export const fillKind: NodeKind<FillData> = {
  kind: 'fill',

  create(init: Partial<FillData> = {}): FillData {
    return {
      kind: 'fill',
      id: init.id ?? generateId('fill'),
      name: init.name ?? 'Fill',
      visible: init.visible ?? true,
      opacity: init.opacity ?? 1,
      mode: init.mode ?? defaultMode('normal'),
      transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: init.locks ?? {
        content: false,
        position: false,
        visibility: false
      },
      fill: init.fill ? normalizeFillSpec(init.fill) : defaultFillSpec(),
      mask: init.mask
    }
  },

  normalize(raw: unknown): FillData {
    const r = (raw ?? {}) as Record<string, unknown>
    const locks = (r.locks ?? {}) as Record<string, unknown>
    return {
      kind: 'fill',
      id: str(r.id, generateId('fill')),
      name: str(r.name, 'Fill'),
      visible: bool(r.visible, true),
      opacity: Math.max(0, Math.min(1, num(r.opacity, 1))),
      mode: (r.mode as FillData['mode']) ?? defaultMode('normal'),
      transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: {
        content: bool(locks.content, false),
        position: bool(locks.position, false),
        visibility: bool(locks.visibility, false)
      },
      fill: normalizeFillSpec(r.fill),
      mask: r.mask as FillData['mask'],
      fx: normalizeLayerFx(r.fx)
    }
  },

  serialize(node: FillData): unknown {
    return {
      kind: 'fill',
      id: node.id,
      name: node.name,
      visible: node.visible,
      opacity: node.opacity,
      mode: node.mode,
      transform: node.transform,
      locks: node.locks,
      fill: cloneFillSpec(node.fill),
      mask: node.mask,
      fx: node.fx
    }
  },

  contentIds(node: FillData): string[] {
    return node.mask ? [node.mask.contentId].filter(Boolean) : []
  },

  async hydrate(node: FillData, deps): Promise<void> {
    if (node.mask && !deps.content.has(node.mask.contentId) && node.mask.url) {
      const canvas = await deps.loadUrl(node.mask.url)
      deps.content.register(canvas, {
        id: node.mask.contentId,
        uploadedUrl: node.mask.url
      })
    }
  },

  renderNode(node: FillData, ctx: RenderNodeCtx): NodeTexture | null {
    const bitmap = fillBitmap(node, ctx.region.w, ctx.region.h)
    if (!bitmap) return null
    return ctx.placed(`content:${node.id}`, fillSpecStamp(node.fill), bitmap, {
      x: 0,
      y: 0,
      w: ctx.region.w,
      h: ctx.region.h,
      rotation: 0
    })
  },

  bbox(): Rect {
    return { x: 0, y: 0, w: 0, h: 0 }
  },

  thumbnail(): HTMLCanvasElement | null {
    return null
  },

  hitTest(): boolean {
    return false
  }
}
