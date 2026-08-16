import type { NodeTexture } from '../compositor'
import {
  defaultFillSpec,
  fillSpecStamp,
  normalizeFillSpec,
  renderFillBitmap
} from '../fill'
import { generateId } from '../id'
import { defaultMode } from '../mode'
import type { FillData, Rect } from '../node'
import type { NodeKind, RenderNodeCtx } from '../nodeKind'

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

  contentIds(node: FillData): string[] {
    return node.mask ? [node.mask.contentId].filter(Boolean) : []
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

  hitTest(): boolean {
    return false
  }
}
