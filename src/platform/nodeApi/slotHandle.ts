/**
 * Slot handles and connectivity.
 *
 * Replaces the deleted `input.link` / `output.links` mirrors. Reads go through
 * the link store via `slotLinks`, and every list-shaped read is a frozen
 * snapshot — so disconnecting while iterating is safe, which is precisely what
 * the old mutable-array mirror made hazardous.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { inputLink, outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { useLinkStore } from '@/stores/linkStore'
import type { EndpointUpdate } from '@/stores/linkStore'
import {
  LinkDirection,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { CONFIG, GET_CONFIG } from '@/services/litegraphService'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { mergeInputSpec } from '@/utils/nodeDefUtil'

import { ComfyApiError } from './errors'
import { resolveInputSource } from './resolution'
import type { Resolver } from './resolution'
import { describeSlotRef, resolveSlotRef, slotIdOf } from './slotRef'
import type { SlotId, SlotRef } from './slotRef'
import type { WidgetValue } from './widgetHandle'

export interface LinkInfo {
  readonly id: string
  readonly sourceNodeId: string
  readonly sourceSlotId: SlotId
  readonly targetNodeId: string
  readonly targetSlotId: SlotId
  readonly type: string
  /** Position at snapshot time. Do not store across mutations. */
  readonly sourceIndex: number
  readonly targetIndex: number
}

/**
 * Fields a pack may change on an existing slot.
 *
 * Applied atomically as one command, so a retype-plus-rename is a single undo
 * step rather than two. Retyping deliberately **keeps existing links**: dynamic
 * retyping (`*` -> `MODEL`) is the whole point for `SetNode`-style packs, and
 * silently dropping connections is the failure mode this API exists to end.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
/**
 * A slot's type, which may be a union.
 *
 * An array spells "this slot accepts any of these" — rgthree's
 * `addInput('input', ['IMAGE', 'LATENT', 'MASK'])` is the shipped example, so
 * packs do write it even though litegraph's own `ISlotType` says
 * `number | string`.
 *
 * Both forms are accepted and stored as the comma string, because that is what
 * litegraph compares against: it normalises with `String(type).split(',')`, so
 * `['IMAGE','LATENT','MASK']` and `'IMAGE,LATENT,MASK'` are the same slot to
 * every connection check. The saved workflow therefore holds the string where
 * the original held an array — a byte difference with no behavioural one, and
 * the same call already taken for slot `shape`.
 *
 * Reads stay `string` for the same reason.
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export type SlotType = string | string[]

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type SlotDirection = 'none' | 'up' | 'down' | 'left' | 'right' | 'center'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SlotPosition {
  readonly x: number
  readonly y: number
}

const SLOT_DIRECTIONS: Readonly<Record<SlotDirection, LinkDirection>> = {
  none: LinkDirection.NONE,
  up: LinkDirection.UP,
  down: LinkDirection.DOWN,
  left: LinkDirection.LEFT,
  right: LinkDirection.RIGHT,
  center: LinkDirection.CENTER
}

const PUBLIC_DIRECTIONS: Readonly<
  Partial<Record<LinkDirection, SlotDirection>>
> = {
  [LinkDirection.NONE]: 'none',
  [LinkDirection.UP]: 'up',
  [LinkDirection.DOWN]: 'down',
  [LinkDirection.LEFT]: 'left',
  [LinkDirection.RIGHT]: 'right',
  [LinkDirection.CENTER]: 'center'
}

/** Both spellings mean one thing to litegraph; store the one it compares. */
const normaliseType = (type: SlotType) =>
  Array.isArray(type) ? type.join(',') : type

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SlotPatch {
  name?: string
  label?: string | undefined
  /** The backend-provided translated caption. Null clears it. */
  localizedName?: string | null
  type?: SlotType
  /** Slot centre relative to the node body. Null restores automatic layout. */
  position?: SlotPosition | null
  /** Direction in which links leave the slot. Null restores the default. */
  direction?: SlotDirection | null
  /**
   * The dot's colour when connected and when not.
   *
   * Not decoration, despite appearances: both sit on `INodeSlot` and
   * `ISerialisableNodeInput` omits only `boundingRect`, `widget` and `link`,
   * so they are written into the saved workflow. A pack that coloured its
   * slots and then stopped saves different bytes than it used to.
   *
   * `null` clears one back to the renderer's default.
   */
  color?: string | null
  colorWhenUnconnected?: string | null
  /**
   * Sits on the same `INodeSlot` as the colours above and is omitted by the
   * same `Omit`, so the argument made for them holds verbatim: a pack that
   * shaped its slots and then stopped saves different bytes than it used to.
   *
   * `'default'` clears it back to the renderer's own choice.
   */
  shape?: SlotShape
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface InputSlotPatch extends SlotPatch {
  /** Retargets the widget this input is the socket form of. Null clears it. */
  widget?: string | null
  /** Replaces the input declaration used by connected Primitive nodes. */
  widgetConfig?: InputWidgetConfig
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface InputWidgetConfig {
  /** Backend input type, or the choices for a COMBO input. */
  readonly type: string | readonly (string | number)[]
  readonly options?: Readonly<Record<string, unknown>>
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SlotSnapshot {
  readonly id: SlotId
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly localizedName: string | undefined
  readonly position: SlotPosition | undefined
  readonly direction: SlotDirection | undefined
  readonly shape: SlotShape
  readonly isConnected: boolean
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type ResolvedInputSource =
  | {
      readonly kind: 'output'
      readonly graphId: string
      readonly nodeId: string
      readonly outputIndex: number
    }
  | { readonly kind: 'literal'; readonly value: WidgetValue }
  | { readonly kind: 'omitted'; readonly reason: string }

export interface InputSlotHandle {
  readonly id: SlotId
  /** Volatile — shifts when other slots are added or removed. */
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly isConnected: boolean
  /** The type arriving through the link, including across a subgraph input. */
  readonly connectedType: string | undefined
  /** Whether this input is the socket form of a widget. */
  readonly isWidgetInput: boolean
  /** The declaration a connected Primitive node renders. */
  widgetConfig(): Readonly<InputWidgetConfig> | undefined
  /** Intersects this input's declaration with another compatible one. */
  mergeWidgetConfig(
    config: InputWidgetConfig
  ): Readonly<InputWidgetConfig> | undefined
  link(): LinkInfo | undefined
  source(): { nodeId: string; outputIndex: number } | undefined
  /**
   * What ultimately feeds this input after frontend nodes resolve.
   *
   * `source()` reports the physical link, which is right for editing topology.
   * This reports the executable source through reroutes, Get/Set nodes and any
   * other frontend node declared with `defs.define({ resolve })`. Resolution is
   * read-only and leaves the graph untouched.
   */
  resolvedSource(): ResolvedInputSource | undefined
  disconnect(): boolean
  modify(patch: InputSlotPatch): void
  /** Replaces `{...input}`, which now yields nothing useful. */
  snapshot(): Readonly<SlotSnapshot>
}

export interface OutputSlotHandle {
  readonly id: SlotId
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly isConnected: boolean
  /** Frozen snapshot — safe to iterate while disconnecting. */
  links(): readonly LinkInfo[]
  targets(): readonly { nodeId: string; inputIndex: number }[]
  connectTo(targetNodeId: string, input: SlotRef): LinkInfo | undefined
  disconnect(targetNodeId?: string): boolean
  modify(patch: SlotPatch): void
  /**
   * Moves every link on this output to another output of the same node,
   * **preserving link ids**.
   *
   * Disconnect-and-reconnect is not equivalent: it allocates new ids, so the
   * serialized workflow changes. Packs that re-home their own outputs during a
   * migration depend on identity being kept.
   *
   * Slot types are **not** re-validated. The real-world sequence moves links
   * off an output and then retypes it, so enforcing compatibility mid-move
   * would reject exactly the case this exists for.
   */
  moveLinksTo(target: SlotRef): readonly LinkInfo[]
  snapshot(): Readonly<SlotSnapshot>
}

export interface SlotCollection<THandle> {
  readonly length: number
  get(ref: SlotRef): THandle | undefined
  byId(id: SlotId): THandle | undefined
  byName(name: string): THandle | undefined
  /** Explicit positional access. */
  at(index: number): THandle | undefined
  all(): readonly THandle[]
  ids(): readonly SlotId[]
  names(): readonly string[]
  /**
   * Adds a slot. 18 packs grow their inputs as the last one fills — the
   * "Multi" combiner pattern — which needed `node.addInput` until now.
   *
   * `shape` is not decoration: it is written into the saved workflow, so a
   * slot added without the one its pack used to set serialises differently
   * from one the pack itself wrote. `'optional'` is the hollow circle
   * ComfyUI draws for an input that need not be connected.
   */
  add(name: string, type: SlotType, options?: SlotOptions): THandle
  /**
   * Removes a slot by reference. Any link into it is dropped, as it would be
   * on the legacy path.
   */
  remove(ref: SlotRef): boolean
  /**
   * Puts the slots in the given order. `names` must be a permutation of the
   * current ones.
   *
   * Every link into or out of this node is re-pointed as part of the move, in
   * one batch, so link ids — and therefore the saved workflow's `links` array
   * — are unchanged. That is the whole reason this exists rather than being
   * left to packs: a link stores its endpoint as a slot *index*, so a pack
   * permuting the array itself silently re-points every connection, and the
   * damage only shows when the workflow is next run.
   *
   * The slot *order* is serialized, so this changes the saved file by design —
   * it is how a pack keeps its dynamic inputs matching what the backend
   * declares.
   */
  reorder(names: readonly string[]): void
  [Symbol.iterator](): Iterator<THandle>
}

const typeOf = (slot: INodeInputSlot | INodeOutputSlot) =>
  typeof slot.type === 'string' ? slot.type : String(slot.type ?? '*')

export function toLinkInfo(
  graph: LGraph,
  link: {
    id: unknown
    origin_id: unknown
    origin_slot: number
    target_id: unknown
    target_slot: number
    type: unknown
  }
): LinkInfo | undefined {
  const origin = graph.getNodeById(toNodeId(String(link.origin_id)))
  const target = graph.getNodeById(toNodeId(String(link.target_id)))
  const outSlot = origin?.outputs?.[link.origin_slot]
  const inSlot = target?.inputs?.[link.target_slot]
  if (!outSlot || !inSlot) return undefined

  return Object.freeze({
    id: String(link.id),
    sourceNodeId: String(link.origin_id),
    sourceSlotId: slotIdOf(outSlot),
    targetNodeId: String(link.target_id),
    targetSlotId: slotIdOf(inSlot),
    type: typeof link.type === 'string' ? link.type : String(link.type ?? '*'),
    sourceIndex: link.origin_slot,
    targetIndex: link.target_slot
  })
}

function applyPatch(
  slot: INodeInputSlot | INodeOutputSlot | undefined,
  patch: SlotPatch
): void {
  if (!slot) return
  if (patch.name !== undefined) slot.name = patch.name
  if ('label' in patch) slot.label = patch.label
  if ('localizedName' in patch) {
    slot.localized_name = patch.localizedName ?? undefined
  }
  if (patch.type !== undefined) slot.type = normaliseType(patch.type)
  if ('position' in patch) {
    slot.pos = patch.position ? [patch.position.x, patch.position.y] : undefined
  }
  if ('direction' in patch) {
    slot.dir =
      patch.direction === null || patch.direction === undefined
        ? undefined
        : SLOT_DIRECTIONS[patch.direction]
  }
  if ('color' in patch) slot.color_on = patch.color ?? undefined
  if ('colorWhenUnconnected' in patch) {
    slot.color_off = patch.colorWhenUnconnected ?? undefined
  }
  if (patch.shape !== undefined) {
    slot.shape =
      patch.shape === 'default' ? undefined : SLOT_SHAPES[patch.shape]
  }
}

function toInputSpec(config: InputWidgetConfig): InputSpec {
  const type = Array.isArray(config.type) ? [...config.type] : config.type
  return [type, { ...config.options }] as InputSpec
}

function fromInputSpec(spec: InputSpec): Readonly<InputWidgetConfig> {
  const type = Array.isArray(spec[0]) ? Object.freeze([...spec[0]]) : spec[0]
  return Object.freeze({
    type,
    ...(spec[1] ? { options: Object.freeze({ ...spec[1] }) } : {})
  })
}

function inputWidgetSpec(slot: INodeInputSlot): InputSpec | undefined {
  const custom = slot.widget?.[CONFIG]
  if (custom) return custom as InputSpec
  const getConfig = slot.widget?.[GET_CONFIG]
  return typeof getConfig === 'function'
    ? (getConfig() as InputSpec)
    : undefined
}

function recreateConnectedPrimitive(
  graph: LGraph | null | undefined,
  node: LGraphNode,
  slot: INodeInputSlot
): void {
  if (!graph) return
  const index = node.inputs.indexOf(slot)
  const link = inputLink(graph, node.id, index)
  const origin = link ? graph.getNodeById(link.origin_id) : undefined
  if (origin?.type !== 'PrimitiveNode') return
  const recreate = (origin as LGraphNode & { recreateWidget?: () => unknown })
    .recreateWidget
  recreate?.call(origin)
}

function clearInputWidget(
  graph: LGraph | null | undefined,
  node: LGraphNode,
  slot: INodeInputSlot
): void {
  const index = node.inputs.indexOf(slot)
  const link = graph ? inputLink(graph, node.id, index) : undefined
  const origin = link && graph ? graph.getNodeById(link.origin_id) : undefined
  delete slot.widget
  if (origin?.type !== 'PrimitiveNode') return
  const primitive = origin as LGraphNode & { onLastDisconnect?: () => void }
  primitive.disconnectOutput(0)
  primitive.onLastDisconnect?.call(primitive)
}

function setInputWidgetConfig(
  graph: LGraph | null | undefined,
  node: LGraphNode,
  slot: INodeInputSlot,
  config: InputWidgetConfig
): void {
  if (!slot.widget) {
    throw new ComfyApiError(
      `Input '${slot.name}' is not the socket form of a widget.`
    )
  }
  const inputSpec = toInputSpec(config)
  slot.widget[GET_CONFIG] = () => inputSpec
  recreateConnectedPrimitive(graph, node, slot)
}

function snapshotSlot(
  slot: INodeInputSlot | INodeOutputSlot,
  index: number,
  isConnected: boolean
): Readonly<SlotSnapshot> {
  return Object.freeze({
    id: slotIdOf(slot),
    index,
    name: slot.name,
    type: typeOf(slot),
    label: slot.label,
    localizedName: slot.localized_name,
    position: slot.pos
      ? Object.freeze({ x: slot.pos[0], y: slot.pos[1] })
      : undefined,
    direction: slot.dir === undefined ? undefined : PUBLIC_DIRECTIONS[slot.dir],
    shape: slotShapeNameOf(slot),
    isConnected
  })
}

function createInputHandle(
  getGraph: () => LGraph | null | undefined,
  getNode: () => LGraphNode | undefined,
  slotId: SlotId,
  getResolvers: () => ReadonlyMap<string, Resolver>
): InputSlotHandle {
  const indexOf = () => {
    const inputs = getNode()?.inputs ?? []
    return inputs.findIndex((s) => slotIdOf(s) === slotId)
  }
  const slotAt = () => {
    const i = indexOf()
    return i === -1 ? undefined : getNode()?.inputs?.[i]
  }

  const handle: InputSlotHandle = {
    get id() {
      return slotId
    },
    get index() {
      return indexOf()
    },
    get name() {
      return slotAt()?.name ?? ''
    },
    get type() {
      const s = slotAt()
      return s ? typeOf(s) : ''
    },
    get label() {
      return slotAt()?.label
    },
    get isConnected() {
      const node = getNode()
      const i = indexOf()
      return node && i !== -1 ? node.isInputConnected(i) : false
    },
    get connectedType() {
      const graph = getGraph()
      const node = getNode()
      const i = indexOf()
      if (!graph || !node || i === -1) return undefined
      const link = inputLink(graph, node.id, i)
      const type = link?.resolve(graph).subgraphInput?.type ?? link?.type
      return type === undefined
        ? undefined
        : typeof type === 'string'
          ? type
          : String(type)
    },
    get isWidgetInput() {
      return slotAt()?.widget !== undefined
    },
    widgetConfig() {
      const slot = slotAt()
      const spec = slot && inputWidgetSpec(slot)
      return spec ? fromInputSpec(spec) : undefined
    },
    mergeWidgetConfig(config) {
      const graph = getGraph()
      const node = getNode()
      const slot = slotAt()
      if (!node || !slot?.widget) return undefined
      const current = inputWidgetSpec(slot)
      if (!current) return undefined
      const merged = mergeInputSpec(current, toInputSpec(config))
      if (!merged) return undefined
      slot.widget[CONFIG] = merged
      recreateConnectedPrimitive(graph, node, slot)
      return fromInputSpec(merged)
    },
    link() {
      const graph = getGraph()
      const node = getNode()
      const i = indexOf()
      if (!graph || !node || i === -1) return undefined
      const l = inputLink(graph, node.id, i)
      return l ? toLinkInfo(graph, l) : undefined
    },
    source() {
      const info = handle.link()
      return info
        ? { nodeId: info.sourceNodeId, outputIndex: info.sourceIndex }
        : undefined
    },
    resolvedSource() {
      const graph = getGraph()
      const node = getNode()
      const input = indexOf()
      if (!graph || !node || input === -1) return undefined

      const source = resolveInputSource(
        graph,
        String(node.id),
        input,
        getResolvers()
      )
      if (!source) return undefined
      if (source.kind === 'output') {
        return Object.freeze({
          kind: 'output',
          graphId: String(graph.id),
          nodeId: source.nodeId,
          outputIndex: source.output
        })
      }
      return Object.freeze({ ...source })
    },
    disconnect() {
      const node = getNode()
      const i = indexOf()
      return node && i !== -1 ? node.disconnectInput(i) : false
    },
    modify(patch) {
      const node = getNode()
      const current = slotAt()
      if (
        patch.widgetConfig &&
        (patch.widget === null ||
          (!current?.widget && patch.widget === undefined))
      ) {
        throw new ComfyApiError(
          `Input '${current?.name ?? ''}' needs a widget before it can receive widgetConfig.`
        )
      }
      if (
        patch.widget !== undefined &&
        patch.widget !== null &&
        !patch.widgetConfig &&
        !node?.widgets?.some((widget) => widget.name === patch.widget)
      ) {
        throw new ComfyApiError(
          `No widget named '${patch.widget}' on this node, so the slot cannot be its socket form.`
        )
      }
      const slot = slotAt()
      applyPatch(slot, patch)
      if (slot && patch.widget !== undefined) {
        if (patch.widget === null) {
          if (node) clearInputWidget(getGraph(), node, slot)
        } else if (slot.widget?.name !== patch.widget) {
          slot.widget = { name: patch.widget }
        }
      }
      if (slot && node && patch.widgetConfig) {
        setInputWidgetConfig(getGraph(), node, slot, patch.widgetConfig)
      }
    },
    snapshot() {
      const s = slotAt()
      const i = indexOf()
      return s
        ? snapshotSlot(s, i, handle.isConnected)
        : Object.freeze({
            id: slotId,
            index: -1,
            name: '',
            type: '',
            label: undefined,
            localizedName: undefined,
            position: undefined,
            direction: undefined,
            shape: 'default',
            isConnected: false
          })
    }
  }
  return Object.freeze(handle)
}

function createOutputHandle(
  getGraph: () => LGraph | null | undefined,
  getNode: () => LGraphNode | undefined,
  slotId: SlotId
): OutputSlotHandle {
  const indexOf = () => {
    const outputs = getNode()?.outputs ?? []
    return outputs.findIndex((s) => slotIdOf(s) === slotId)
  }
  const slotAt = () => {
    const i = indexOf()
    return i === -1 ? undefined : getNode()?.outputs?.[i]
  }

  const handle: OutputSlotHandle = {
    get id() {
      return slotId
    },
    get index() {
      return indexOf()
    },
    get name() {
      return slotAt()?.name ?? ''
    },
    get type() {
      const s = slotAt()
      return s ? typeOf(s) : ''
    },
    get label() {
      return slotAt()?.label
    },
    get isConnected() {
      const node = getNode()
      const i = indexOf()
      return node && i !== -1 ? node.isOutputConnected(i) : false
    },
    links() {
      const graph = getGraph()
      const node = getNode()
      const i = indexOf()
      if (!graph || !node || i === -1) return Object.freeze([])
      const infos = outputLinks(graph, node.id, i)
        .map((l) => toLinkInfo(graph, l))
        .filter((v): v is LinkInfo => v !== undefined)
      return Object.freeze(infos)
    },
    targets() {
      return Object.freeze(
        handle
          .links()
          .map((l) => ({ nodeId: l.targetNodeId, inputIndex: l.targetIndex }))
      )
    },
    connectTo(targetNodeId, input) {
      const graph = getGraph()
      const node = getNode()
      const i = indexOf()
      if (!graph || !node || i === -1) return undefined

      const target = graph.getNodeById(toNodeId(targetNodeId))
      if (!target) {
        throw new ComfyApiError(
          `No node with id '${targetNodeId}' in this graph.`
        )
      }
      const inputIndex = resolveSlotRef(target.inputs ?? [], input)
      if (inputIndex === -1) {
        throw new ComfyApiError(
          `No input matching ${describeSlotRef(input)} on node '${targetNodeId}'.`
        )
      }
      const link = node.connect(i, target, inputIndex)
      return link ? toLinkInfo(graph, link) : undefined
    },
    disconnect(targetNodeId) {
      const graph = getGraph()
      const node = getNode()
      const i = indexOf()
      if (!node || i === -1) return false
      const target = targetNodeId
        ? (graph?.getNodeById(toNodeId(targetNodeId)) ?? undefined)
        : undefined
      return node.disconnectOutput(i, target)
    },
    modify(patch) {
      const node = getNode()
      const index = indexOf()
      if (node && index !== -1 && patch.type !== undefined) {
        node.setOutputDataType(index, normaliseType(patch.type))
      }
      applyPatch(slotAt(), patch)
    },
    moveLinksTo(target) {
      const graph = getGraph()
      const node = getNode()
      const from = indexOf()
      if (!graph || !node || from === -1) return Object.freeze([])

      const to = resolveSlotRef(node.outputs ?? [], target)
      if (to === -1) {
        throw new ComfyApiError(
          `No output matching ${describeSlotRef(target)} on this node.`
        )
      }
      if (to === from) return handle.links()

      // Retarget in the link store: endpoints are patched in place, so link
      // ids — and therefore the serialized workflow — are preserved.
      const store = useLinkStore()
      const scope = graphScopeOf(graph)
      const topologies = [...store.getOutputSlotLinks(scope, node.id, from)]
      if (!topologies.length) return Object.freeze([])

      const result = store.updateEndpoints(
        scope,
        topologies.map((topology) => ({ topology, patch: { originSlot: to } }))
      )
      if (!result.ok) {
        throw new ComfyApiError(
          `Could not move links to ${describeSlotRef(target)}: the target slot rejected them.`
        )
      }
      const moved = outputLinks(graph, node.id, to)
        .map((l) => toLinkInfo(graph, l))
        .filter((v): v is LinkInfo => v !== undefined)
      return Object.freeze(moved)
    },
    snapshot() {
      const s = slotAt()
      const i = indexOf()
      return s
        ? snapshotSlot(s, i, handle.isConnected)
        : Object.freeze({
            id: slotId,
            index: -1,
            name: '',
            type: '',
            label: undefined,
            localizedName: undefined,
            position: undefined,
            direction: undefined,
            shape: 'default',
            isConnected: false
          })
    }
  }
  return Object.freeze(handle)
}

/**
 * How a slot is drawn, which ComfyUI overloads to mean how it behaves.
 *
 * Named rather than numbered: packs wrote `{ shape: 7 }`, and 7 is meaningless
 * without litegraph's RenderShape enum in front of you.
 */
export type SlotShape = 'default' | 'optional' | 'list' | 'directional'

const SLOT_SHAPES: Record<Exclude<SlotShape, 'default'>, RenderShape> = {
  optional: RenderShape.HollowCircle,
  list: RenderShape.GRID,
  directional: RenderShape.ARROW
}

function slotShapeNameOf(slot: INodeInputSlot | INodeOutputSlot): SlotShape {
  if (slot.shape === SLOT_SHAPES.optional) return 'optional'
  if (slot.shape === SLOT_SHAPES.list) return 'list'
  if (slot.shape === SLOT_SHAPES.directional) return 'directional'
  return 'default'
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SlotOptions {
  /**
   * `'optional'` is the hollow circle for an input that need not be connected,
   * `'list'` the grid ComfyUI draws for an output that yields many values, and
   * `'directional'` the arrow a pack uses for a slot that only ever feeds one
   * particular kind of node.
   */
  shape?: SlotShape
  localizedName?: string
  position?: SlotPosition
  direction?: SlotDirection
  /**
   * Names the widget this slot is the socket form of — the "convert widget to
   * input" shape.
   *
   * Not decoration either: a slot carrying it serialises as
   * `{ widget: { name } }` where a plain socket serialises as `{ pos }`, and
   * the widget keeps its place in `widgets_values`. A dynamic input added
   * without it changes the saved file.
   */
  widget?: string
  /** The declaration a connected Primitive node should render. */
  widgetConfig?: InputWidgetConfig
}

/**
 * The same named vocabulary for `defs.define`, whose outputs are built through
 * `addOutput` rather than through a `SlotOptions`.
 */
export function slotShapeOf(shape?: SlotShape) {
  return shape && shape !== 'default'
    ? { shape: SLOT_SHAPES[shape] }
    : undefined
}

function slotProperties(options?: SlotOptions) {
  if (!options) return undefined
  const properties: Partial<INodeInputSlot> = {}
  if (options.shape && options.shape !== 'default') {
    properties.shape = SLOT_SHAPES[options.shape]
  }
  if (options.localizedName !== undefined) {
    properties.localized_name = options.localizedName
  }
  if (options.position) {
    properties.pos = [options.position.x, options.position.y]
  }
  if (options.direction) {
    properties.dir = SLOT_DIRECTIONS[options.direction]
  }
  if (options.widget) {
    const widget: NonNullable<INodeInputSlot['widget']> = {
      name: options.widget
    }
    if (options.widgetConfig) {
      const inputSpec = toInputSpec(options.widgetConfig)
      widget[GET_CONFIG] = () => inputSpec
    }
    properties.widget = widget
  }
  return Object.keys(properties).length ? properties : undefined
}

/**
 * Puts a node's slots in a new order and re-points every affected link.
 *
 * A link stores its endpoint as a slot *index*, so permuting the array alone
 * silently re-points every connection, and the damage only surfaces the next
 * time the workflow runs. The store patches endpoints in one batch — it
 * displaces all of them before re-placing — so a swap cannot collide with
 * itself mid-permutation, and link ids survive, which keeps the saved
 * `links` array unchanged.
 */
function reorderSlots(
  graph: LGraph | null | undefined,
  node: LGraphNode | undefined,
  side: 'input' | 'output',
  names: readonly string[]
): void {
  const slots = (side === 'input' ? node?.inputs : node?.outputs) as
    | (INodeInputSlot | INodeOutputSlot)[]
    | undefined
  if (!graph || !node || !slots) return

  const from = new Map(slots.map((slot, index) => [slot.name, index]))
  const moved = names.map((name) => slots[from.get(name)!])

  const store = useLinkStore()
  const scope = graphScopeOf(graph)
  const patches: EndpointUpdate[] = []
  for (const [to, name] of names.entries()) {
    const wasAt = from.get(name)!
    if (wasAt === to) continue
    if (side === 'input') {
      const topology = store.getInputSlotLink(scope, node.id, wasAt)
      if (topology) patches.push({ topology, patch: { targetSlot: to } })
    } else {
      for (const topology of store.getOutputSlotLinks(scope, node.id, wasAt)) {
        patches.push({ topology, patch: { originSlot: to } })
      }
    }
  }

  slots.length = 0
  slots.push(...moved)

  if (!patches.length) return
  const result = store.updateEndpoints(scope, patches)
  if (!result.ok) {
    throw new ComfyApiError(
      `Could not re-point links while reordering slots: ${String(result.error)}`
    )
  }
}

function createCollection<THandle>(
  getSlots: () => readonly (INodeInputSlot | INodeOutputSlot)[],
  makeHandle: (slotId: SlotId) => THandle,
  mutate: {
    add: (name: string, type: SlotType, options?: SlotOptions) => void
    remove: (index: number) => void
    reorder: (names: readonly string[]) => void
  }
): SlotCollection<THandle> {
  const handleAt = (index: number) => {
    const slot = getSlots()[index]
    return slot ? makeHandle(slotIdOf(slot)) : undefined
  }

  const collection: SlotCollection<THandle> = {
    get length() {
      return getSlots().length
    },
    get: (ref) => handleAt(resolveSlotRef(getSlots(), ref)),
    byId: (id) => handleAt(resolveSlotRef(getSlots(), id)),
    reorder(names) {
      const current = getSlots().map((slot) => slot.name)
      if (
        names.length !== current.length ||
        [...names].sort().join('\u0000') !== [...current].sort().join('\u0000')
      ) {
        throw new ComfyApiError(
          `reorder() needs a permutation of the current slots ` +
            `[${current.join(', ')}], got [${[...names].join(', ')}].`
        )
      }
      mutate.reorder([...names])
    },

    add(name, type, options) {
      mutate.add(name, type, options)
      const handle = handleAt(getSlots().length - 1)
      if (!handle) {
        throw new ComfyApiError(
          `Adding slot '${name}' produced nothing — the node may no longer exist.`
        )
      }
      return handle
    },
    remove(ref) {
      const index = resolveSlotRef(getSlots(), ref)
      if (index < 0 || index >= getSlots().length) return false
      mutate.remove(index)
      return true
    },
    byName(name) {
      const slots = getSlots()
      const matches = slots.filter((s) => s.name === name)
      // Ambiguous names resolve to undefined here rather than throwing, so a
      // lookup stays total; `get()` throws because intent was explicit.
      return matches.length === 1
        ? handleAt(slots.indexOf(matches[0]))
        : undefined
    },
    at: handleAt,
    all: () => Object.freeze(getSlots().map((s) => makeHandle(slotIdOf(s)))),
    ids: () => Object.freeze(getSlots().map((s) => slotIdOf(s))),
    names: () => Object.freeze(getSlots().map((s) => s.name)),
    *[Symbol.iterator]() {
      for (let i = 0; i < getSlots().length; i++) {
        const h = handleAt(i)
        if (h) yield h
      }
    }
  }
  return Object.freeze(collection)
}

export function createInputCollection(
  getGraph: () => LGraph | null | undefined,
  getNode: () => LGraphNode | undefined,
  getResolvers: () => ReadonlyMap<string, Resolver> = () => new Map()
): SlotCollection<InputSlotHandle> {
  return createCollection(
    () => getNode()?.inputs ?? [],
    (slotId) => createInputHandle(getGraph, getNode, slotId, getResolvers),
    {
      add: (name, type, options) => {
        const node = getNode()
        if (options?.widgetConfig && !options.widget) {
          throw new ComfyApiError(
            `Input '${name}' needs a widget before it can receive widgetConfig.`
          )
        }
        if (
          options?.widget &&
          !options.widgetConfig &&
          !node?.widgets?.some((w) => w.name === options.widget)
        ) {
          // A misspelled name would produce a slot that serialises as a widget
          // input for a widget that is not there — a saved file the loader
          // cannot reconcile. Loud now beats corrupt later.
          throw new ComfyApiError(
            `No widget named '${options.widget}' on this node, so the slot cannot be its socket form.`
          )
        }
        node?.addInput(name, normaliseType(type), slotProperties(options))
      },
      remove: (index) => getNode()?.removeInput(index),
      reorder: (names) => reorderSlots(getGraph(), getNode(), 'input', names)
    }
  )
}

export function createOutputCollection(
  getGraph: () => LGraph | null | undefined,
  getNode: () => LGraphNode | undefined
): SlotCollection<OutputSlotHandle> {
  return createCollection(
    () => getNode()?.outputs ?? [],
    (slotId) => createOutputHandle(getGraph, getNode, slotId),
    {
      add: (name, type, options) =>
        getNode()?.addOutput(
          name,
          normaliseType(type),
          slotProperties(options)
        ),
      remove: (index) => getNode()?.removeOutput(index),
      reorder: (names) => reorderSlots(getGraph(), getNode(), 'output', names)
    }
  )
}
