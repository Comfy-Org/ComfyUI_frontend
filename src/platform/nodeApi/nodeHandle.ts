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

export type NodeMode = 'always' | 'never' | 'bypass' | 'on-event' | 'on-trigger'
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

export interface NodeHandle extends HandleCommon {
  readonly id: string
  readonly type: string
  title: string
  mode: NodeMode
  collapsed: boolean
  pinned: boolean
  color: string | undefined
  bgColor: string | undefined
  shape: NodeShape
  /**
   * Whether this node emits `widgets_values` when the workflow is serialized.
   *
   * Writable because packs vary it per node type, and the value is part of the
   * wire format — a conversion that could not set it would change what the
   * saved workflow contains.
   */
  serializesWidgets: boolean
  readonly position: Point
  readonly size: Size
  readonly inputs: SlotCollection<InputSlotHandle>
  readonly outputs: SlotCollection<OutputSlotHandle>
  readonly widgets: WidgetCollection
  setPosition(x: number, y: number): void
  setSize(width: number, height: number): void
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
            'Node type is identity. Use graph.replaceNode() to change it.'
        },
        title: { get: (n) => n.title, set: (n, v) => (n.title = String(v)) },
        mode: {
          get: (n) => MODE_TO_PUBLIC[n.mode] ?? 'always',
          set: (n, v) => {
            const mode = MODE_TO_INTERNAL[v as NodeMode]
            if (mode === undefined) {
              throw new TypeError(
                `Invalid node mode '${String(v)}'. Expected one of: ${Object.keys(MODE_TO_INTERNAL).join(', ')}.`
              )
            }
            n.mode = mode
          }
        },
        collapsed: {
          get: (n) => n.flags.collapsed ?? false,
          set: (n, v) => setFlag(n, 'collapsed', Boolean(v))
        },
        serializesWidgets: {
          get: (n) => n.serialize_widgets ?? false,
          set: (n, v) => (n.serialize_widgets = Boolean(v))
        },
        pinned: {
          get: (n) => n.flags.pinned ?? false,
          set: (n, v) => setFlag(n, 'pinned', Boolean(v))
        },
        color: {
          get: (n) => n.color,
          set: (n, v) => (n.color = v === undefined ? undefined : String(v))
        },
        bgColor: {
          get: (n) => n.bgcolor,
          set: (n, v) => (n.bgcolor = v === undefined ? undefined : String(v))
        },
        shape: {
          get: (n) =>
            n.shape === undefined ? 'default' : SHAPE_TO_PUBLIC[n.shape],
          set: (n, v) => {
            if (!(String(v) in SHAPE_TO_INTERNAL)) {
              throw new TypeError(
                `Invalid node shape '${String(v)}'. Expected one of: ${Object.keys(SHAPE_TO_INTERNAL).join(', ')}.`
              )
            }
            n.shape = SHAPE_TO_INTERNAL[v as NodeShape] as RenderShape
          }
        },
        position: { get: (n) => freezePoint(n.pos[0], n.pos[1]) },
        size: { get: (n) => freezeSize(n.size[0], n.size[1]) },
        inputs: { get: (n) => collections.inputs(String(n.id)) },
        outputs: { get: (n) => collections.outputs(String(n.id)) },
        widgets: { get: (n) => collections.widgets(String(n.id)) }
      },
      methods: {
        setPosition: (n, ...args) => {
          const [x, y] = args as unknown as [number, number]
          n.pos = [x, y]
        },
        setSize: (n, ...args) => {
          const [width, height] = args as unknown as [number, number]
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
