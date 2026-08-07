/**
 * `NodeHandle` — the public view of a graph node.
 *
 * Bound to `LGraphNode` here, but nothing about that is observable from the
 * handle: it resolves by id on every access and exposes only the declared
 * surface. Internals can be refactored without breaking the contract, which is
 * the entire reason this layer exists.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  LGraphEventMode,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'
import { toNodeId } from '@/types/nodeId'

import { createHandleFactory } from './closedProxy'
import type { HandleCommon } from './closedProxy'
import type {
  InputSlotHandle,
  OutputSlotHandle,
  SlotCollection
} from './slotHandle'
import type { WidgetCollection } from './widgetHandle'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type NodeMode = 'always' | 'never' | 'bypass' | 'on-event' | 'on-trigger'
/** @knipIgnoreUnusedButUsedByCustomNodes */
export type NodeShape = 'default' | 'box' | 'round' | 'circle' | 'card'

export interface Point {
  readonly x: number
  readonly y: number
}
export interface Size {
  readonly width: number
  readonly height: number
}

export interface NodeSnapshot {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly mode: NodeMode
  readonly collapsed: boolean
  readonly pinned: boolean
  readonly color: string | undefined
  readonly bgColor: string | undefined
  readonly shape: NodeShape
  readonly position: Point
  readonly size: Size
}

/**
 * Shapes follow `src/types/extensionV2.ts`, the agreed extension contract:
 * accessor methods rather than properties, so a read can be a store query and
 * a write can dispatch a command.
 */
export interface SizeConstraints {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  /** Grow to fit content rather than holding a fixed height. */
  autoHeight?: boolean
}

export interface NodeHandle extends HandleCommon {
  readonly id: string
  readonly type: string
  readonly comfyClass: string

  getTitle(): string
  setTitle(title: string): void
  getMode(): NodeMode
  setMode(mode: NodeMode): void
  isCollapsed(): boolean
  setCollapsed(collapsed: boolean): void
  isPinned(): boolean
  setPinned(pinned: boolean): void
  getColor(): string | undefined
  setColor(color: string | undefined): void
  getBgColor(): string | undefined
  setBgColor(color: string | undefined): void
  getShape(): NodeShape
  setShape(shape: NodeShape): void
  getProperty<T = unknown>(key: string): T | undefined
  getProperties(): Readonly<Record<string, unknown>>
  setProperty(key: string, value: unknown): void
  /**
   * Whether this node emits `widgets_values` when the workflow is serialized.
   *
   * Writable because packs vary it per node type, and the value is part of the
   * wire format — a conversion that could not set it would change what the
   * saved workflow contains.
   */
  isSerializingWidgets(): boolean
  setSerializeWidgets(serialize: boolean): void

  getPosition(): Point
  setPosition(pos: Point): void
  getSize(): Size
  setSize(size: Size): void
  /**
   * Declares how the node may be sized, instead of re-asserting it per frame.
   *
   * 39 packs recompute size inside a draw or resize callback, which is both a
   * per-frame cost and a fight with the layout. `autoHeight` is usually the
   * real intent: the pack mounted something of unknown height and wants the
   * node to fit it.
   */
  setSizeConstraints(constraints: SizeConstraints): void
  getSizeConstraints(): Readonly<SizeConstraints>

  readonly inputs: SlotCollection<InputSlotHandle>
  readonly outputs: SlotCollection<OutputSlotHandle>
  readonly widgets: WidgetCollection
  snapshot(): Readonly<NodeSnapshot> | undefined
  remove(): void
}

/** Per-node collections, supplied by the graph layer that owns their caches. */
export interface NodeCollections {
  inputs(nodeId: string): SlotCollection<InputSlotHandle>
  outputs(nodeId: string): SlotCollection<OutputSlotHandle>
  widgets(nodeId: string): WidgetCollection
}

const MODE_TO_PUBLIC: Record<LGraphEventMode, NodeMode> = {
  [LGraphEventMode.ALWAYS]: 'always',
  [LGraphEventMode.NEVER]: 'never',
  [LGraphEventMode.BYPASS]: 'bypass',
  [LGraphEventMode.ON_EVENT]: 'on-event',
  [LGraphEventMode.ON_TRIGGER]: 'on-trigger'
}
const MODE_TO_INTERNAL: Record<NodeMode, LGraphEventMode> = {
  always: LGraphEventMode.ALWAYS,
  never: LGraphEventMode.NEVER,
  bypass: LGraphEventMode.BYPASS,
  'on-event': LGraphEventMode.ON_EVENT,
  'on-trigger': LGraphEventMode.ON_TRIGGER
}

const SHAPE_TO_PUBLIC: Record<number, NodeShape> = {
  [RenderShape.BOX]: 'box',
  [RenderShape.ROUND]: 'round',
  [RenderShape.CIRCLE]: 'circle',
  [RenderShape.CARD]: 'card'
}
const SHAPE_TO_INTERNAL: Record<NodeShape, RenderShape | undefined> = {
  default: undefined,
  box: RenderShape.BOX,
  round: RenderShape.ROUND,
  circle: RenderShape.CIRCLE,
  card: RenderShape.CARD
}

/** Frozen so a pack cannot mutate geometry by writing through a read. */
const freezePoint = (x: number, y: number): Point => Object.freeze({ x, y })
const freezeSize = (width: number, height: number): Size =>
  Object.freeze({ width, height })

function snapshotOf(node: LGraphNode): Readonly<NodeSnapshot> {
  return Object.freeze({
    id: String(node.id),
    type: node.type,
    title: node.title,
    mode: MODE_TO_PUBLIC[node.mode] ?? 'always',
    collapsed: node.flags.collapsed ?? false,
    pinned: node.flags.pinned ?? false,
    color: node.color,
    bgColor: node.bgcolor,
    shape: node.shape === undefined ? 'default' : SHAPE_TO_PUBLIC[node.shape],
    position: freezePoint(node.pos[0], node.pos[1]),
    size: freezeSize(node.size[0], node.size[1])
  })
}

/**
 * Declared constraints, by node id.
 *
 * Held here rather than on the node: the entity classes are closed, and a
 * constraint is this layer's concern, not litegraph's.
 */
const constraintsByNode = new Map<string, SizeConstraints>()

/** Clamps the node to its constraints now, and on every later resize. */
function applyConstraints(node: LGraphNode, c: SizeConstraints) {
  const clamp = () => {
    const [width, height] = node.size
    const next: [number, number] = [
      Math.min(c.maxWidth ?? Infinity, Math.max(c.minWidth ?? 0, width)),
      Math.min(c.maxHeight ?? Infinity, Math.max(c.minHeight ?? 0, height))
    ]
    if (next[0] !== width || next[1] !== height) node.size = next
  }

  // Chained rather than assigned: another pack may already be listening, and
  // this layer must not be the one that breaks composition.
  const previous = node.onResize
  node.onResize = function (this: LGraphNode, size) {
    previous?.call(this, size)
    clamp()
  }
  if (c.autoHeight) node.size = [node.size[0], node.computeSize()[1]]
  clamp()
}

/** Mutating a copy avoids relying on in-place mutation of the flags object. */
function setFlag(node: LGraphNode, flag: 'collapsed' | 'pinned', on: boolean) {
  node.flags = { ...node.flags, [flag]: on }
}

export function createNodeHandles(
  getGraph: () => LGraph | null | undefined,
  collections: NodeCollections,
  namespace = ''
) {
  return createHandleFactory<LGraphNode>(
    {
      kind: 'node',
      identityProps: ['id'],
      props: {
        id: { get: (n) => String(n.id) },
        type: {
          get: (n) => n.type,
          readonlyHint:
            'Node type is identity, and there is no published way to change it.'
        },
        inputs: { get: (n) => collections.inputs(String(n.id)) },
        outputs: { get: (n) => collections.outputs(String(n.id)) },
        widgets: { get: (n) => collections.widgets(String(n.id)) },
        // A property, matching the interface. Registered as a method it read
        // back as a bound function, so every `switch (node.comfyClass)` fell
        // through silently — the exact failure this layer exists to prevent.
        comfyClass: {
          get: (n) => (n as { comfyClass?: string }).comfyClass ?? n.type,
          readonlyHint: 'Node class is identity and cannot be reassigned.'
        }
      },
      methods: {
        getTitle: (n) => n.title,
        setTitle: (n, ...args) => {
          n.title = String(args[0])
        },
        getMode: (n) => MODE_TO_PUBLIC[n.mode] ?? 'always',
        setMode: (n, ...args) => {
          const mode = MODE_TO_INTERNAL[args[0] as NodeMode]
          if (mode === undefined) {
            throw new TypeError(
              `Invalid node mode '${String(args[0])}'. Expected one of: ${Object.keys(MODE_TO_INTERNAL).join(', ')}.`
            )
          }
          n.mode = mode
        },
        isCollapsed: (n) => n.flags.collapsed ?? false,
        setCollapsed: (n, ...args) => setFlag(n, 'collapsed', Boolean(args[0])),
        isPinned: (n) => n.flags.pinned ?? false,
        setPinned: (n, ...args) => setFlag(n, 'pinned', Boolean(args[0])),
        getColor: (n) => n.color,
        setColor: (n, ...args) => {
          n.color = args[0] === undefined ? undefined : String(args[0])
        },
        getBgColor: (n) => n.bgcolor,
        setBgColor: (n, ...args) => {
          n.bgcolor = args[0] === undefined ? undefined : String(args[0])
        },
        getShape: (n) =>
          n.shape === undefined ? 'default' : SHAPE_TO_PUBLIC[n.shape],
        setShape: (n, ...args) => {
          if (!(String(args[0]) in SHAPE_TO_INTERNAL)) {
            throw new TypeError(
              `Invalid node shape '${String(args[0])}'. Expected one of: ${Object.keys(SHAPE_TO_INTERNAL).join(', ')}.`
            )
          }
          n.shape = SHAPE_TO_INTERNAL[args[0] as NodeShape] as RenderShape
        },
        isSerializingWidgets: (n) => n.serialize_widgets ?? false,
        setSerializeWidgets: (n, ...args) => {
          n.serialize_widgets = Boolean(args[0])
        },
        getProperty: (n, ...args) => n.properties?.[String(args[0])],
        getProperties: (n) => Object.freeze({ ...n.properties }),
        setProperty: (n, ...args) => {
          n.properties = { ...n.properties, [String(args[0])]: args[1] }
        },
        getPosition: (n) => freezePoint(n.pos[0], n.pos[1]),
        setPosition: (n, ...args) => {
          const { x, y } = args[0] as Point
          n.pos = [x, y]
        },
        getSize: (n) => freezeSize(n.size[0], n.size[1]),
        getSizeConstraints: (n) =>
          Object.freeze({ ...(constraintsByNode.get(String(n.id)) ?? {}) }),
        setSizeConstraints: (n, ...args) => {
          const next = { ...(args[0] as SizeConstraints) }
          constraintsByNode.set(String(n.id), next)
          applyConstraints(n, next)
        },
        setSize: (n, ...args) => {
          const { width, height } = args[0] as Size
          n.size = [width, height]
        },
        snapshot: (n) => snapshotOf(n),
        remove: (n) => {
          n.graph?.remove(n)
        }
      }
    },
    (id) => getGraph()?.getNodeById(toNodeId(id)) ?? undefined,
    namespace
  )
}
