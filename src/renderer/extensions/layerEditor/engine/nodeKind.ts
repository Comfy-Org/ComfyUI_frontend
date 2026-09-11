import type { NodeBase, Rect, Transform, Vec2 } from './node'
import type { Compositor, NodeTexture } from './compositor'
import type { ContentStore } from './content'
import type { Command } from './history'

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

export interface NodeKind<T extends NodeBase = NodeBase> {
  kind: string

  create(init?: Partial<T>): T

  contentIds(node: T): string[]

  renderNode(node: T, ctx: RenderNodeCtx): NodeTexture | null

  bbox(node: T): Rect

  hitTest?(node: T, pt: Vec2): boolean

  onTransformCommitted?(
    node: T,
    before: Transform,
    deps: { content: ContentStore }
  ): Command | null
}

const registry = new Map<string, NodeKind>()

export function registerNodeKind<T extends NodeBase>(kind: NodeKind<T>): void {
  registry.set(kind.kind, kind)
}

export function getNodeKind(kind: string): NodeKind {
  const k = registry.get(kind)
  if (!k) throw new Error(`Unknown node kind: ${kind}`)
  return k
}

export function hasNodeKind(kind: string): boolean {
  return registry.has(kind)
}
