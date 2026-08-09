import type { NodeTexture } from '../compositor'
import { generateId } from '../id'
import { defaultMode } from '../mode'
import type { NodeKind } from '../nodeKind'
import type { RasterData, Rect, Transform, Vec2 } from '../node'

function defaultTransform(w: number, h: number): Transform {
  return { x: 0, y: 0, w, h, rotation: 0 }
}

export const rasterKind: NodeKind<RasterData> = {
  kind: 'raster',

  create(init: Partial<RasterData> = {}): RasterData {
    const nw = init.naturalWidth ?? 512
    const nh = init.naturalHeight ?? 512
    return {
      kind: 'raster',
      id: init.id ?? generateId('layer'),
      name: init.name ?? 'Layer',
      visible: init.visible ?? true,
      opacity: init.opacity ?? 1,
      mode: init.mode ?? defaultMode('normal'),
      transform: init.transform ?? defaultTransform(nw, nh),
      locks: init.locks ?? {
        content: false,
        position: false,
        visibility: false
      },
      contentId: init.contentId ?? '',
      url: init.url,
      naturalWidth: nw,
      naturalHeight: nh,
      lockAlpha: init.lockAlpha ?? false,
      mask: init.mask
    }
  },

  contentIds(node: RasterData): string[] {
    const ids = [node.contentId]
    if (node.mask) ids.push(node.mask.contentId)
    return ids.filter(Boolean)
  },

  renderNode(node: RasterData, ctx): NodeTexture | null {
    const entry = ctx.content.get(node.contentId)
    if (!entry) return null
    return ctx.placed(
      `content:${node.id}`,
      node.contentId,
      entry.canvas,
      node.transform
    )
  },

  bbox(node: RasterData): Rect {
    return {
      x: node.transform.x,
      y: node.transform.y,
      w: node.transform.w,
      h: node.transform.h
    }
  },

  hitTest(node: RasterData, pt: Vec2): boolean {
    const b = this.bbox(node)
    return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h
  }
}
