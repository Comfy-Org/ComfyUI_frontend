import type { NodeTexture } from '../compositor'
import { generateId } from '../id'
import { defaultMode } from '../mode'
import type { NodeKind } from '../nodeKind'
import type { RasterData, Rect, Transform, Vec2 } from '../node'
import { normalizeLayerFx } from '../render/layerFx'

function defaultTransform(w: number, h: number): Transform {
  return { x: 0, y: 0, w, h, rotation: 0 }
}

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && isFinite(v) ? v : d
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean): boolean =>
  typeof v === 'boolean' ? v : d

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

  normalize(raw: unknown): RasterData {
    const r = (raw ?? {}) as Record<string, unknown>
    const t = (r.transform ?? {}) as Record<string, unknown>
    const nw = num(r.naturalWidth, 512)
    const nh = num(r.naturalHeight, 512)
    const locks = (r.locks ?? {}) as Record<string, unknown>
    return {
      kind: 'raster',
      id: str(r.id, generateId('layer')),
      name: str(r.name, 'Layer'),
      visible: bool(r.visible, true),
      opacity: Math.max(0, Math.min(1, num(r.opacity, 1))),
      mode: (r.mode as RasterData['mode']) ?? defaultMode('normal'),
      transform: {
        x: num(t.x, 0),
        y: num(t.y, 0),
        w: num(t.w, nw),
        h: num(t.h, nh),
        rotation: num(t.rotation, 0)
      },
      locks: {
        content: bool(locks.content, false),
        position: bool(locks.position, false),
        visibility: bool(locks.visibility, false)
      },
      contentId: str(r.contentId, ''),
      url: typeof r.url === 'string' ? r.url : undefined,
      naturalWidth: nw,
      naturalHeight: nh,
      lockAlpha: r.lockAlpha === true,
      mask: r.mask as RasterData['mask'],
      fx: normalizeLayerFx(r.fx)
    }
  },

  serialize(node: RasterData): unknown {
    return {
      kind: 'raster',
      id: node.id,
      name: node.name,
      visible: node.visible,
      opacity: node.opacity,
      mode: node.mode,
      transform: node.transform,
      locks: node.locks,
      contentId: node.contentId,
      url: node.url,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
      lockAlpha: node.lockAlpha ?? false,
      mask: node.mask,
      fx: node.fx
    }
  },

  contentIds(node: RasterData): string[] {
    const ids = [node.contentId]
    if (node.mask) ids.push(node.mask.contentId)
    return ids.filter(Boolean)
  },

  async hydrate(node: RasterData, deps): Promise<void> {
    if (node.contentId && !deps.content.has(node.contentId) && node.url) {
      const canvas = await deps.loadUrl(node.url)
      deps.content.register(canvas, {
        id: node.contentId,
        uploadedUrl: node.url
      })
    }
    if (node.mask && !deps.content.has(node.mask.contentId) && node.mask.url) {
      const canvas = await deps.loadUrl(node.mask.url)
      deps.content.register(canvas, {
        id: node.mask.contentId,
        uploadedUrl: node.mask.url
      })
    }
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

  thumbnail(node: RasterData, deps): HTMLCanvasElement | null {
    const entry = deps.content.get(node.contentId)
    return entry?.canvas ?? null
  },

  hitTest(node: RasterData, pt: Vec2): boolean {
    const b = this.bbox(node)
    return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h
  }
}
