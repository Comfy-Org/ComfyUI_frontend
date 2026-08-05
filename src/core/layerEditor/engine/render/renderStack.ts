import type { AdjustmentOp } from '../adjust'
import { ADJUST_CODE, curvesLutData, packParams } from '../adjust'
import type { Compositor, CompositeInput, NodeTexture } from '../compositor'
import type { ContentStore } from '../content'
import type { Document } from '../document'
import { resolveMode } from '../mode'
import type {
  AdjustmentData,
  GroupData,
  Rect,
  SceneNode,
  Transform
} from '../node'
import type { RenderNodeCtx } from '../nodeKind'
import { getNodeKind } from '../nodeKind'
import type { LayerFxData } from './layerFx'
import { fxStamp, getFxProcessed } from './layerFx'
import type { Bitmap } from './place'
import { placeBitmap } from './place'

export interface PlacedEntry {
  stamp: string
  canvas: HTMLCanvasElement
}

export interface PreviewOverride {
  canvas: HTMLCanvasElement
  version: number
  rects?: Rect[] | null
}

export interface RenderDeps {
  content: ContentStore
  compositor: Compositor
  devicePixelRatio?: number
  overrides?: Map<string, PreviewOverride>
  placedCache?: Map<string, PlacedEntry>
}

export interface BuiltInputs {
  inputs: CompositeInput[]
  cleanup: () => void
}

function transformStamp(t: Transform): string {
  return `${t.x},${t.y},${t.w},${t.h},${t.rotation}`
}

function makePlaced(
  deps: RenderDeps,
  region: Rect,
  used: Set<string>,
  fxRef: { current: LayerFxData[] | null }
) {
  return (
    cacheKey: string,
    contentStamp: string,
    bitmap: Bitmap,
    transform: Transform,
    linear = false
  ): NodeTexture | null => {
    let fxTag = ''
    const fx = fxRef.current
    if (fx && fx.length && cacheKey.startsWith('content:')) {
      const processed = getFxProcessed(cacheKey, contentStamp, bitmap, fx)
      if (processed) {
        const sx = transform.w / Math.max(1, bitmap.width)
        const sy = transform.h / Math.max(1, bitmap.height)
        bitmap = processed.canvas
        transform = {
          x: transform.x - processed.pad * sx,
          y: transform.y - processed.pad * sy,
          w: transform.w + 2 * processed.pad * sx,
          h: transform.h + 2 * processed.pad * sy,
          rotation: transform.rotation
        }
        fxTag = `|${fxStamp(fx)}`
      }
    }
    const stamp = `${contentStamp}|${transformStamp(transform)}|${region.w}x${region.h}${fxTag}`
    const cache = deps.placedCache
    if (!cache) {
      const canvas = placeBitmap(bitmap, transform, region.w, region.h)
      return canvas
        ? { source: canvas, rect: region, linear, key: stamp }
        : null
    }
    used.add(cacheKey)
    const entry = cache.get(cacheKey)
    if (entry && entry.stamp === stamp) {
      return { source: entry.canvas, rect: region, linear, key: stamp }
    }
    const canvas = placeBitmap(
      bitmap,
      transform,
      region.w,
      region.h,
      entry?.canvas
    )
    if (!canvas) return null
    cache.set(cacheKey, { stamp, canvas })
    return { source: canvas, rect: region, linear, key: stamp }
  }
}

type PlacedFn = ReturnType<typeof makePlaced>

function renderMaskTexture(
  node: SceneNode,
  region: Rect,
  deps: RenderDeps,
  placed: PlacedFn,
  used: Set<string>
): NodeTexture | undefined {
  const m = node.mask
  if (!m || !m.enabled) return undefined
  const tf =
    node.transform.w > 0 && node.transform.h > 0
      ? node.transform
      : { x: 0, y: 0, w: region.w, h: region.h, rotation: 0 }
  const override = deps.overrides?.get(`mask:${node.id}`)
  if (override) {
    return (
      renderPreviewTexture(
        `preview:mask:${node.id}`,
        override,
        tf,
        region,
        deps,
        used,
        true
      ) ?? undefined
    )
  }
  const bitmap = deps.content.get(m.contentId)?.canvas
  if (!bitmap) return undefined
  return placed(`mask:${node.id}`, m.contentId, bitmap, tf, true) ?? undefined
}

function renderLeafTexture(
  node: SceneNode,
  ctx: RenderNodeCtx,
  deps: RenderDeps,
  used: Set<string>
): NodeTexture | null {
  const override = deps.overrides?.get(`content:${node.id}`)
  if (override) {
    const texture = renderPreviewTexture(
      `preview:content:${node.id}`,
      override,
      node.transform,
      ctx.region,
      deps,
      used,
      false
    )
    if (texture) return texture
  }
  return getNodeKind(node.kind).renderNode(node, ctx)
}

function renderPreviewTexture(
  cacheKey: string,
  override: PreviewOverride,
  transform: Transform,
  region: Rect,
  deps: RenderDeps,
  used: Set<string>,
  linear: boolean
): NodeTexture | null {
  const cache = deps.placedCache
  if (!cache) {
    const canvas = placeBitmap(
      override.canvas,
      transform,
      region.w,
      region.h,
      undefined,
      null,
      true
    )
    return canvas ? { source: canvas, rect: region, linear } : null
  }
  used.add(cacheKey)
  const meta = `${transformStamp(transform)}|${region.w}x${region.h}`
  const stamp = `v${override.version}|${meta}`
  const entry = cache.get(cacheKey)
  if (entry && entry.stamp === stamp) {
    return {
      source: entry.canvas,
      rect: region,
      linear,
      key: cacheKey,
      version: override.version
    }
  }
  const prevVersion = entry
    ? Number(/^v(\d+)\|/.exec(entry.stamp)?.[1] ?? NaN)
    : NaN
  const partial =
    entry &&
    entry.stamp.endsWith(`|${meta}`) &&
    prevVersion === override.version - 1
      ? (override.rects ?? null)
      : null
  let canvas: HTMLCanvasElement | null
  if (partial && entry) {
    canvas = entry.canvas
    for (const r of partial) {
      canvas = placeBitmap(
        override.canvas,
        transform,
        region.w,
        region.h,
        canvas ?? undefined,
        r,
        true
      )
      if (!canvas) break
    }
  } else {
    canvas = placeBitmap(
      override.canvas,
      transform,
      region.w,
      region.h,
      entry?.canvas,
      null,
      true
    )
  }
  if (!canvas) return null
  cache.set(cacheKey, { stamp, canvas })
  return {
    source: canvas,
    rect: region,
    linear,
    key: cacheKey,
    version: override.version,
    dirtyRects: partial ?? undefined
  }
}

function buildInputs(
  group: GroupData,
  doc: Document,
  deps: RenderDeps,
  used: Set<string>
): BuiltInputs {
  const region: Rect = { x: 0, y: 0, w: doc.width, h: doc.height }
  const inputs: CompositeInput[] = []
  const cleanups: Array<() => void> = []
  const fxRef: { current: LayerFxData[] | null } = { current: null }
  const placed = makePlaced(deps, region, used, fxRef)
  const ctx: RenderNodeCtx = {
    compositor: deps.compositor,
    content: deps.content,
    renderChild: () => null,
    placed,
    region,
    devicePixelRatio: deps.devicePixelRatio ?? 1
  }

  for (const node of group.children) {
    if (!node.visible || node.opacity <= 0) continue

    if (node.kind === 'adjustment') {
      const adj = node as AdjustmentData
      const docSpace = {
        ...node,
        transform: { x: 0, y: 0, w: region.w, h: region.h, rotation: 0 }
      } as SceneNode
      inputs.push({
        adjust: {
          op: ADJUST_CODE[adj.op as AdjustmentOp] ?? 0,
          params: packParams(adj.op as AdjustmentOp, adj.params),
          lut: adj.op === 'curves' ? curvesLutData(adj.curves) : undefined
        },
        opacity: node.opacity,
        mask: renderMaskTexture(docSpace, region, deps, placed, used)
      })
      continue
    }

    if (node.kind === 'group') {
      const g = node as GroupData
      const sub = buildInputs(g, doc, deps, used)
      if (g.passThrough) {
        inputs.push(...sub.inputs)
        cleanups.push(sub.cleanup)
        continue
      }
      const handle = deps.compositor.allocTarget(doc.width, doc.height)
      deps.compositor.composite(sub.inputs, handle)
      sub.cleanup()
      cleanups.push(() => deps.compositor.freeTarget(handle))
      inputs.push({
        texture: {
          source: deps.compositor.targetTexture(handle),
          rect: region,
          linear: true
        },
        opacity: node.opacity,
        mode: resolveMode(node.mode),
        mask: renderMaskTexture(node, region, deps, placed, used)
      })
      continue
    }

    fxRef.current = node.fx?.length ? node.fx : null
    const texture = renderLeafTexture(node, ctx, deps, used)
    fxRef.current = null
    if (!texture) continue
    inputs.push({
      texture,
      opacity: node.opacity,
      mode: resolveMode(node.mode),
      mask: renderMaskTexture(node, region, deps, placed, used)
    })
  }

  return { inputs, cleanup: () => cleanups.forEach((fn) => fn()) }
}

export function buildDocumentInputs(
  doc: Document,
  deps: RenderDeps
): BuiltInputs {
  return buildInputs(doc.root, doc, deps, new Set())
}

export function renderDocument(
  doc: Document,
  deps: RenderDeps,
  extra?: CompositeInput[],
  region?: Rect | null
): void {
  deps.compositor.beginFrame?.()
  const used = new Set<string>()
  const { inputs, cleanup } = buildInputs(doc.root, doc, deps, used)
  deps.compositor.composite(
    extra?.length ? [...inputs, ...extra] : inputs,
    null,
    region ?? undefined
  )
  cleanup()
  if (deps.placedCache) {
    for (const key of [...deps.placedCache.keys()]) {
      if (!used.has(key)) deps.placedCache.delete(key)
    }
  }
}
