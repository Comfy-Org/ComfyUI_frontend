import type { NodeBase, Rect, Transform, Vec2 } from './node'
import type { Compositor, NodeTexture } from './compositor'
import type { ContentStore } from './content'
import type { Command } from './history'

export interface HydrateDeps {
  content: ContentStore
  loadUrl(url: string): Promise<HTMLCanvasElement>
}

export interface RenderNodeCtx {
  compositor: Compositor
  content: ContentStore

  renderChild(node: NodeBase, region: Rect): NodeTexture | null
  placed(
    cacheKey: string,
    contentStamp: string,
    bitmap: HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
    transform: Transform,
    linear?: boolean
  ): NodeTexture | null
  region: Rect
  devicePixelRatio: number
}

export interface ThumbnailDeps {
  content: ContentStore
  size: number
}

export interface NodeKind<T extends NodeBase = NodeBase> {
  kind: string

  create(init?: Partial<T>): T

  normalize(raw: unknown): T

  serialize(node: T): unknown

  contentIds(node: T): string[]

  hydrate(node: T, deps: HydrateDeps): Promise<void>

  renderNode(node: T, ctx: RenderNodeCtx): NodeTexture | null

  bbox(node: T): Rect

  thumbnail(node: T, deps: ThumbnailDeps): HTMLCanvasElement | null

  hitTest?(node: T, pt: Vec2): boolean

  onTransformCommitted?(
    node: T,
    before: Transform,
    deps: { content: ContentStore }
  ): Command | null
}

const registry = new Map<string, NodeKind>()

export function registerNodeKind<T extends NodeBase>(kind: NodeKind<T>): void {
  registry.set(kind.kind, kind as unknown as NodeKind)
}

export function getNodeKind(kind: string): NodeKind {
  const k = registry.get(kind)
  if (!k) throw new Error(`Unknown node kind: ${kind}`)
  return k
}

export function hasNodeKind(kind: string): boolean {
  return registry.has(kind)
}

export function nodeKinds(): string[] {
  return [...registry.keys()]
}
