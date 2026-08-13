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
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { toNodeId } from '@/types/nodeId'

import { ComfyApiError } from './errors'
import { describeSlotRef, resolveSlotRef, slotIdOf } from './slotRef'
import type { SlotId, SlotRef } from './slotRef'

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

/** Both spellings mean one thing to litegraph; store the one it compares. */
const normaliseType = (type: SlotType) =>
  Array.isArray(type) ? type.join(',') : type

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SlotPatch {
  name?: string
  label?: string | undefined
  type?: SlotType
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
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SlotSnapshot {
  readonly id: SlotId
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly isConnected: boolean
}

export interface InputSlotHandle {
  readonly id: SlotId
  /** Volatile — shifts when other slots are added or removed. */
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly isConnected: boolean
  /** Whether this input is the socket form of a widget. */
  readonly isWidgetInput: boolean
  link(): LinkInfo | undefined
  source(): { nodeId: string; outputIndex: number } | undefined
  disconnect(): boolean
  modify(patch: SlotPatch): void
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
  if (patch.type !== undefined) slot.type = normaliseType(patch.type)
  if ('color' in patch) slot.color_on = patch.color ?? undefined
  if ('colorWhenUnconnected' in patch) {
    slot.color_off = patch.colorWhenUnconnected ?? undefined
  }
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
    isConnected
  })
}

function createInputHandle(
  getGraph: () => LGraph | null | undefined,
  getNode: () => LGraphNode | undefined,
  slotId: SlotId
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
    get isWidgetInput() {
      return slotAt()?.widget !== undefined
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
    disconnect() {
      const node = getNode()
      const i = indexOf()
      return node && i !== -1 ? node.disconnectInput(i) : false
    },
    modify(patch) {
      applyPatch(slotAt(), patch)
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
      const graphId = graph.rootGraph.id
      const topologies = [...store.getOutputSlotLinks(graphId, node.id, from)]
      if (!topologies.length) return Object.freeze([])

      const result = store.updateEndpoints(
        graphId,
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
interface SlotOptions {
  shape?: 'default' | 'optional'
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
}

function slotProperties(options?: SlotOptions) {
  if (!options) return undefined
  const properties: Partial<INodeInputSlot> = {}
  if (options.shape === 'optional') properties.shape = RenderShape.HollowCircle
  if (options.widget) properties.widget = { name: options.widget }
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
  const graphId = graph.rootGraph.id
  const patches: EndpointUpdate[] = []
  for (const [to, name] of names.entries()) {
    const wasAt = from.get(name)!
    if (wasAt === to) continue
    if (side === 'input') {
      const topology = store.getInputSlotLink(graphId, node.id, wasAt)
      if (topology) patches.push({ topology, patch: { targetSlot: to } })
    } else {
      for (const topology of store.getOutputSlotLinks(
        graphId,
        node.id,
        wasAt
      )) {
        patches.push({ topology, patch: { originSlot: to } })
      }
    }
  }

  slots.length = 0
  slots.push(...moved)

  if (!patches.length) return
  const result = store.updateEndpoints(graphId, patches)
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
  getNode: () => LGraphNode | undefined
): SlotCollection<InputSlotHandle> {
  return createCollection(
    () => getNode()?.inputs ?? [],
    (slotId) => createInputHandle(getGraph, getNode, slotId),
    {
      add: (name, type, options) => {
        const node = getNode()
        if (
          options?.widget &&
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
      add: (name, type) => getNode()?.addOutput(name, normaliseType(type)),
      remove: (index) => getNode()?.removeOutput(index),
      reorder: (names) => reorderSlots(getGraph(), getNode(), 'output', names)
    }
  )
}
