import type {
  Compositor,
  CompositeInput,
  FBOHandle,
  NodeTexture
} from '../compositor'
import type { ContentStore } from '../content'
import type { Document } from '../document'
import { resolveMode } from '../mode'
import type { GroupData, Rect, SceneNode, Transform } from '../node'
import type { RenderNodeCtx } from '../nodeKind'
import { getNodeKind } from '../nodeKind'
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

function makePlaced(deps: RenderDeps, region: Rect, used: Set<string>) {
  return (
    cacheKey: string,
    contentStamp: string,
    bitmap: Bitmap,
    transform: Transform,
    linear = false
  ): NodeTexture | null => {
    const stamp = `${contentStamp}|${transformStamp(transform)}|${region.w}x${region.h}`
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
  const placed = makePlaced(deps, region, used)
  const ctx: RenderNodeCtx = {
    compositor: deps.compositor,
    content: deps.content,
    renderChild: () => null,
    placed,
    region,
    devicePixelRatio: deps.devicePixelRatio ?? 1
  }

  try {
    for (const node of group.children) {
      if (!node.visible || node.opacity <= 0) continue

      if (node.kind === 'group') {
        const g = node as GroupData
        const sub = buildInputs(g, doc, deps, used)
        if (g.passThrough) {
          inputs.push(...sub.inputs)
          cleanups.push(sub.cleanup)
          continue
        }
        let handle: FBOHandle
        try {
          handle = deps.compositor.allocTarget(doc.width, doc.height)
        } catch (err) {
          sub.cleanup()
          throw err
        }
        try {
          deps.compositor.composite(sub.inputs, handle)
        } catch (err) {
          deps.compositor.freeTarget(handle)
          sub.cleanup()
          throw err
        }
        sub.cleanup()
        cleanups.push(() => deps.compositor.freeTarget(handle))
        const groupTexture = deps.compositor.targetTexture(handle)
        if (groupTexture) {
          inputs.push({
            texture: { source: groupTexture, rect: region, linear: true },
            opacity: node.opacity,
            mode: resolveMode(node.mode),
            mask: renderMaskTexture(node, region, deps, placed, used)
          })
        }
        continue
      }

      const texture = renderLeafTexture(node, ctx, deps, used)
      if (!texture) continue
      inputs.push({
        texture,
        opacity: node.opacity,
        mode: resolveMode(node.mode),
        mask: renderMaskTexture(node, region, deps, placed, used)
      })
    }
  } catch (err) {
    cleanups.forEach((fn) => fn())
    throw err
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
  try {
    deps.compositor.composite(
      extra?.length ? [...inputs, ...extra] : inputs,
      null,
      region ?? undefined
    )
  } finally {
    cleanup()
  }
  if (deps.placedCache) {
    for (const key of [...deps.placedCache.keys()]) {
      if (!used.has(key)) deps.placedCache.delete(key)
    }
  }
}
