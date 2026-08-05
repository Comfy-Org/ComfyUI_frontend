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
export interface SlotPatch {
  name?: string
  label?: string | undefined
  type?: string
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
  if (patch.type !== undefined) slot.type = patch.type
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

function createCollection<THandle>(
  getSlots: () => readonly (INodeInputSlot | INodeOutputSlot)[],
  makeHandle: (slotId: SlotId) => THandle
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
    (slotId) => createInputHandle(getGraph, getNode, slotId)
  )
}

export function createOutputCollection(
  getGraph: () => LGraph | null | undefined,
  getNode: () => LGraphNode | undefined
): SlotCollection<OutputSlotHandle> {
  return createCollection(
    () => getNode()?.outputs ?? [],
    (slotId) => createOutputHandle(getGraph, getNode, slotId)
  )
}
