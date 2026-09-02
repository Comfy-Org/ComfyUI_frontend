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
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  LGraphEventMode,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'
import { toNodeId } from '@/types/nodeId'

import { createHandleFactory } from './closedProxy'
import type { HandleCommon } from './closedProxy'
import type {
  InputSlotHandle,
  OutputSlotHandle,
  SlotCollection
} from './slotHandle'
import type { Unsubscribe, WidgetCollection, WidgetValue } from './widgetHandle'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type NodeMode = 'always' | 'never' | 'bypass' | 'on-event' | 'on-trigger'
/** @knipIgnoreUnusedButUsedByCustomNodes */
export type NodeShape = 'default' | 'box' | 'round' | 'circle' | 'card'

export interface BadgeDef {
  readonly text: string
  /** Text colour. Defaults to core's badge foreground. */
  readonly color?: string
  /** Background colour. Defaults to core's badge background. */
  readonly bgColor?: string
  /**
   * Makes the badge clickable.
   *
   * Two conversions declined to turn a button into a badge because a badge
   * that looks pressable and does nothing is worse than the thing it replaced.
   */
  onClick?(): void
}

export interface Point {
  readonly x: number
  readonly y: number
}
export interface Size {
  readonly width: number
  readonly height: number
}
/** A rectangle in graph space. */
export interface Bounds {
  readonly x: number
  readonly y: number
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
 * Shapes follow `docs/node-api/reference.md`, the published contract:
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
  setProperty(key: string, value: WidgetValue): void
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
  /** Changes size through the host's resize protocol, including `onResized`. */
  setSize(size: Size): void
  /**
   * The node's rectangle in graph space, title bar included.
   *
   * `getPosition()` is the body's top-left, so packs building a gesture were
   * reconstructing this by subtracting a title height read off the renderer —
   * which is only right for the default layout, and wrong for a collapsed node
   * or under a different renderer. Ask the renderer instead of re-deriving it.
   */
  getBounds(): Bounds
  /**
   * Where a slot sits, in graph space.
   *
   * The renderer's own answer, so it stays correct for collapsed nodes,
   * widget-backed inputs and layouts that are not the default vertical stack —
   * all cases the `(index + 0.7) * slotHeight` reconstruction gets wrong.
   *
   * `undefined` if there is no slot at that index.
   */
  getSlotPosition(side: 'input' | 'output', index: number): Point | undefined
  /**
   * Where the node currently sits on screen, in client coordinates.
   *
   * For anchoring a floating panel to a node. Packs did this by reading the
   * viewport's pan and zoom and doing the arithmetic themselves, which is both
   * the renderer's business and wrong the moment the transform changes shape.
   *
   * The answer already accounts for zoom, so a pack needing to convert a pixel
   * drag into graph units can divide by `width / getBounds().width` rather than
   * asking for the scale factor.
   *
   * `undefined` when nothing is on screen to measure against.
   */
  getScreenRect(): Bounds | undefined
  /**
   * URLs of the images this node produced when it last executed.
   *
   * Packs read `node.imgs` — the loaded `HTMLImageElement`s core hangs on the
   * node — to walk upstream for the nearest ancestor holding a composite, or
   * to scan the selection for something to feed an editor. `onExecuted` does
   * not answer that: it is per node type, so it never sees another pack's
   * outputs, and it only fires at the moment of execution.
   *
   * URLs rather than elements, deliberately. The loaded element is the
   * renderer's, and its lifetime is the renderer's; a pack that wants pixels
   * can load the URL itself and own the result. This also covers previews,
   * which are what the node is showing when a run is still in flight.
   *
   * Empty when the node has not produced images.
   */
  getOutputImages(): readonly string[]
  /**
   * Which of {@link getOutputImages} the user is looking at, or `undefined`
   * when they have neither selected nor hovered one.
   *
   * A pack copying "the image" or saving one as a model's preview meant the
   * one under the cursor, not the first of the batch. `undefined` is why this
   * is not simply `0`: an entry that acts on a guess writes the wrong file to
   * the server, silently.
   */
  getDisplayedImageIndex(): number | undefined
  /**
   * The id of the graph holding this node — the root graph's id, or a
   * subgraph's.
   *
   * A pack keeping its own records against nodes needs it: node ids are unique
   * per graph, so a key built from the id alone collides once subgraphs are
   * involved. Pair it with `comfy.graph.subgraphs()` to get back to the node.
   */
  readonly graphId: string | undefined
  /**
   * Puts a small label on the node's title bar. Returns a handle that removes
   * it again.
   *
   * Packs draw a status, a count, a cost, a model name. They did it by
   * overriding `onDrawForeground` and painting into the canvas context, which
   * only works under the legacy renderer and puts the pack in the business of
   * laying out text. `badges` is core's own extension point and both renderers
   * draw it.
   *
   * Pass a function for a label that changes: it is called each time the node
   * is drawn, so return quickly and do not build strings you could cache.
   */
  addBadge(badge: BadgeDef | (() => BadgeDef)): Unsubscribe
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
const freezeBounds = (r: ArrayLike<number>): Bounds =>
  Object.freeze({ x: r[0], y: r[1], width: r[2], height: r[3] })

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

/** Nodes whose resize hook is installed, so repeat calls do not re-chain. */
const constrained = new WeakSet<LGraphNode>()

/** Clamps to whatever constraints the node currently declares. */
function clampToConstraints(node: LGraphNode) {
  const c = constraintsByNode.get(String(node.id))
  if (!c) return
  const [width, height] = node.size
  const next: [number, number] = [
    Math.min(c.maxWidth ?? Infinity, Math.max(c.minWidth ?? 0, width)),
    Math.min(c.maxHeight ?? Infinity, Math.max(c.minHeight ?? 0, height))
  ]
  if (next[0] !== width || next[1] !== height) node.size = next
}

function applyConstraints(node: LGraphNode, c: SizeConstraints) {
  // Installed once per node. Chaining on every call grew the handler list
  // without bound, and each wrapper closed over the constraints it was built
  // with — so re-declaring never replaced the old clamp, it added a competing
  // one. Crystools calls this on every populate. The hook reads the current
  // constraints instead, so the latest declaration is the only one that acts.
  if (!constrained.has(node)) {
    constrained.add(node)
    // Chained rather than assigned: another pack may already be listening, and
    // this layer must not be the one that breaks composition.
    const previous = node.onResize
    node.onResize = function (this: LGraphNode, size) {
      previous?.call(this, size)
      clampToConstraints(this)
    }
  }
  if (c.autoHeight) node.size = [node.size[0], node.computeSize()[1]]
  clampToConstraints(node)
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
        graphId: { get: (n) => (n.graph ? String(n.graph.id) : undefined) },
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
          n.setProperty(String(args[0]), args[1])
        },
        getPosition: (n) => freezePoint(n.pos[0], n.pos[1]),
        setPosition: (n, ...args) => {
          const { x, y } = args[0] as Point
          n.pos = [x, y]
        },
        getSize: (n) => freezeSize(n.size[0], n.size[1]),
        getOutputImages: (n) =>
          Object.freeze(useNodeOutputStore().getNodeImageUrls(n) ?? []),
        // `overIndex` is what the renderer sets while the pointer is over an
        // image; `imageIndex` survives the pointer leaving.
        getDisplayedImageIndex: (n) => n.imageIndex ?? n.overIndex ?? undefined,
        addBadge: (n, ...args) => {
          const def = args[0] as BadgeDef | (() => BadgeDef)
          const toBadge = ({ text, color, bgColor, onClick }: BadgeDef) =>
            new LGraphBadge({
              text,
              ...(color ? { fgColor: color } : {}),
              ...(bgColor ? { bgColor } : {}),
              ...(onClick ? { onClick: () => onClick() } : {})
            })
          // The object form is read once: a pack that wants a label to change
          // passes a function, and one that passes an object should not find
          // its badge changing later because it reused the variable.
          const entry =
            typeof def === 'function'
              ? () => toBadge(def())
              : toBadge({ ...def })
          n.badges.push(entry)
          return () => {
            const at = n.badges.indexOf(entry)
            if (at !== -1) n.badges.splice(at, 1)
          }
        },
        getScreenRect: (n) => {
          const canvas = LGraphCanvas.active_canvas
          const element = canvas?.canvas
          if (!canvas || !element) return undefined
          n.updateArea()
          const b = n.getBounding()
          const { scale, offset } = canvas.ds
          const rect = element.getBoundingClientRect()
          // The same transform the renderer draws with: translate by the pan,
          // then scale. Kept here so a pack never has to know it.
          return freezeBounds([
            (b[0] + offset[0]) * scale + rect.left,
            (b[1] + offset[1]) * scale + rect.top,
            b[2] * scale,
            b[3] * scale
          ])
        },
        getBounds: (n) => {
          // The rect is a per-frame cache, so it is stale (or all zeroes)
          // until something has rendered. Refreshing is what the renderer
          // does every frame anyway, and it keeps the answer correct for a
          // pack that asks before the first paint.
          n.updateArea()
          return freezeBounds(n.getBounding())
        },
        getSlotPosition: (n, ...args) => {
          const side = args[0] as 'input' | 'output'
          const index = Number(args[1])
          const slots = side === 'input' ? n.inputs : n.outputs
          if (!slots?.[index]) return undefined
          const [x, y] =
            side === 'input' ? n.getInputPos(index) : n.getOutputPos(index)
          return freezePoint(x, y)
        },
        getSizeConstraints: (n) =>
          Object.freeze({ ...(constraintsByNode.get(String(n.id)) ?? {}) }),
        setSizeConstraints: (n, ...args) => {
          const next = { ...(args[0] as SizeConstraints) }
          constraintsByNode.set(String(n.id), next)
          applyConstraints(n, next)
        },
        setSize: (n, ...args) => {
          const { width, height } = args[0] as Size
          n.setSize([width, height])
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
