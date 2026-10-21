import type { History } from './history'
import type { Document } from './document'
import type { Rect, Vec2 } from './node'
import type { Compositor } from './compositor'
import type { ContentStore } from './content'
import type { GrayMask, SelectionOp } from './editor/selectionMath'

export interface ToolControl {
  active: boolean
  pausedDepth: number

  abortMask: number
  cursor: string
  wantsClick: boolean
  wantsDoubleClick: boolean

  motionMode: 'exact' | 'compressed'
}

export function defaultControl(): ToolControl {
  return {
    active: false,
    pausedDepth: 0,
    abortMask: 0,
    cursor: 'default',
    wantsClick: true,
    wantsDoubleClick: false,
    motionMode: 'compressed'
  }
}

export type CanvasItem =
  | {
      type: 'handle'
      pos: Vec2
      shape: 'square' | 'circle' | 'diamond'
      id?: string
    }
  | { type: 'line'; a: Vec2; b: Vec2 }
  | { type: 'rect'; rect: Rect; rotation?: number; ants?: boolean }
  | { type: 'polyline'; points: Vec2[]; closed?: boolean; ants?: boolean }
  | { type: 'arc'; center: Vec2; radius: number }
  | { type: 'preview'; canvas: HTMLCanvasElement; rect: Rect }

export interface Overlay {
  clear(): void
  add(item: CanvasItem): void

  pause(): void
  resume(): void

  hitHandle(pt: Vec2, screenTolerance: number): string | null
}

export interface ToolContext {
  document(): Document
  history: History
  compositor: Compositor
  content: ContentStore
  overlay: Overlay
  activeNodeId(): string | null
  setActiveNode(id: string | null): void
  selectedNodeIds(): string[]
  setSelectedNodes(ids: string[]): void
  selection: {
    combineShape(label: string, mask: GrayMask, op: SelectionOp): void
    currentMask(): GrayMask | null
    none(): void
  }
  compositePixels(): ImageData | null
  floatSelection(): boolean
  zoom(): number
  snapGrid(): number
  requestRender(): void
}

export interface Tool {
  readonly id: string
  readonly control: ToolControl
  onButtonPress(e: PointerEvent, pt: Vec2): void
  onMotion(e: PointerEvent, pt: Vec2): void
  onButtonRelease(e: PointerEvent, pt: Vec2): void
  onHover(e: PointerEvent, pt: Vec2): void
  cursorFor(pt: Vec2): string
  drawOverlay(overlay: Overlay): void
  onActivate?(): void
  onDeactivate?(): void
}

export interface ToolDef {
  id: string
  create(ctx: ToolContext): Tool
}

const registry = new Map<string, ToolDef>()

export function registerTool(def: ToolDef): void {
  registry.set(def.id, def)
}

export function getTool(id: string): ToolDef {
  const def = registry.get(id)
  if (!def) throw new Error(`Unknown tool: ${id}`)
  return def
}

export function toolIds(): string[] {
  return [...registry.keys()]
}
