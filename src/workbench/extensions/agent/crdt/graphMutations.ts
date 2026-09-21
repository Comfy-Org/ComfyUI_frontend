import { isPlainObject } from 'es-toolkit'

import { isAutogrowGroupMember } from '@/core/graph/widgets/dynamicWidgets'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type {
  ISerialisableNodeInput,
  ISerialisableNodeOutput,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { zAutogrowOptions } from '@/schemas/nodeDefSchema'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import type { WidgetValue } from '@/types/simplifiedWidget'
import { isWidgetId, widgetId } from '@/types/widgetId'

import type { PlacementRect } from './batchPlacement'
import { placementOffset } from './batchPlacement'
import type { PlaceholderWidget, WidgetValuePayload } from './nodePayload'
import {
  cloneWidgetValue,
  nodeTitle,
  parseWidgetValues,
  placeholderWidgets,
  widgetType
} from './nodePayload'

export interface SemanticNodePayload extends Record<string, unknown> {
  id: string | number
  type: string
}

export interface SemanticLinkPayload {
  id: number
  originNodeId: string | number
  originSlot: number
  targetNodeId: string | number
  targetSlot: number
  type: string | number
  /** Final semantic slot records after the shared applier handled this link. */
  originOutputs?: readonly ISerialisableNodeOutput[]
  targetInputs?: readonly ISerialisableNodeInput[]
}

function isSlotRecord(value: unknown): value is { name?: unknown } {
  return value !== null && typeof value === 'object'
}

type PatchableSlot = INodeInputSlot | INodeOutputSlot

const OPTIONAL_SLOT_FIELD_ASSIGNERS: ReadonlyArray<
  (live: PatchableSlot, serialized: PatchableSlot) => void
> = [
  (live, serialized) => {
    if (serialized.localized_name !== undefined)
      live.localized_name = serialized.localized_name
  },
  (live, serialized) => {
    if (serialized.label !== undefined) live.label = serialized.label
  },
  (live, serialized) => {
    if (serialized.dir !== undefined) live.dir = serialized.dir
  },
  (live, serialized) => {
    if (serialized.removable !== undefined)
      live.removable = serialized.removable
  },
  (live, serialized) => {
    if (serialized.shape !== undefined) live.shape = serialized.shape
  },
  (live, serialized) => {
    if (serialized.color_off !== undefined)
      live.color_off = serialized.color_off
  },
  (live, serialized) => {
    if (serialized.color_on !== undefined) live.color_on = serialized.color_on
  },
  (live, serialized) => {
    if (serialized.locked !== undefined) live.locked = serialized.locked
  },
  (live, serialized) => {
    if (serialized.nameLocked !== undefined)
      live.nameLocked = serialized.nameLocked
  },
  (live, serialized) => {
    if (serialized.hasErrors !== undefined)
      live.hasErrors = serialized.hasErrors
  }
]

/**
 * Copies a serialized slot's presentation fields -- `name`, `type`, and the
 * ten optional fields `OPTIONAL_SLOT_FIELD_ASSIGNERS` lists -- onto the
 * live slot object, plus `link`/`links` (handled separately below), so the
 * node keeps its slot identity; an omitted field keeps the live value.
 *
 * `boundingRect` is deliberately excluded: on a real slot instance it is a
 * `Rectangle` (a `Float64Array` subclass) that the renderer measures, and
 * `prepareInputSlot`/`prepareOutputSlots` always stub the serialized side to
 * `[0, 0, 0, 0]`, so copying it would clobber the live measurement with that
 * stub. A plain store record takes `link`/`links` as data, while a node's
 * slot instance derives them from the link store and must not have them
 * assigned.
 */
function patchLiveSlot<T extends PatchableSlot>(live: T, serialized: T): void {
  // `name` and `type` are required on `INodeSlot`, so they are always
  // present and copied unconditionally; every field `OPTIONAL_SLOT_FIELD_
  // ASSIGNERS` handles is optional, and an omitted one keeps the live value.
  live.name = serialized.name
  live.type = serialized.type
  for (const assign of OPTIONAL_SLOT_FIELD_ASSIGNERS) assign(live, serialized)
  if (!isPlainObject(live)) return
  if ('link' in serialized && serialized.link !== undefined) {
    ;(live as INodeInputSlot).link = serialized.link
  }
  if ('links' in serialized && serialized.links !== undefined) {
    ;(live as INodeOutputSlot).links = serialized.links
  }
}

/**
 * Patches each live output slot the document still names, by document
 * index. Outputs are never autogrown, so a live index past the document's
 * own list is never reused -- doing so would resurrect an output the
 * document dropped, with no later reconcile to remove it again. Split out
 * of `commit`'s `connect` case, whose own complexity is otherwise dominated
 * by this one slot-patching loop rather than by the mutation dispatch it
 * exists to do.
 */
function patchLiveOutputSlots(
  liveOutputs: NodeState['outputs'],
  documentOutputs: NodeState['outputs']
): NodeState['outputs'] {
  const outputs = [...documentOutputs]
  for (const [index, output] of liveOutputs.entries()) {
    if (index >= outputs.length) break
    if (isSlotRecord(output) && isSlotRecord(outputs[index])) {
      patchLiveSlot(output, outputs[index])
      outputs[index] = output
    }
  }
  return outputs
}

/**
 * Patches each live input slot by name (inputs may have been reordered
 * locally). Litegraph does not enforce unique input names, so each
 * document slot is consumed at most once -- otherwise two live inputs
 * sharing a name would both resolve to the same document index and one
 * live identity would be silently dropped. Split out of `commit`'s
 * `connect` case for the same reason as `patchLiveOutputSlots`.
 */
function patchLiveInputSlots(
  liveInputs: NodeState['inputs'],
  documentInputs: NodeState['inputs']
): NodeState['inputs'] {
  const inputs = [...documentInputs]
  const consumed = new Set<number>()
  for (const input of liveInputs) {
    if (!isSlotRecord(input)) continue
    const index = inputs.findIndex(
      (candidate, i) => !consumed.has(i) && candidate.name === input.name
    )
    if (index < 0) continue
    consumed.add(index)
    patchLiveSlot(input, inputs[index])
    inputs[index] = input
  }
  return inputs
}

interface SemanticNodeLayout {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

/**
 * Renderer-owned layout mutation port. Semantic state never imports the
 * renderer or writes position into the shared follower Y.Doc.
 */
interface SemanticLayoutMutationPort {
  createNode(
    scope: GraphScope,
    nodeId: NodeId,
    layout: SemanticNodeLayout,
    context: RemoteMutationContext
  ): void
  deleteNodes(
    scope: GraphScope,
    nodeIds: readonly NodeId[],
    context: RemoteMutationContext
  ): void
}

/**
 * Renderer-owned placement geometry. `viewportBounds` returns the visible
 * area in canvas coordinates only while the displayed graph is the scope's
 * owning graph, and null otherwise (background workflow, subgraph editing,
 * no canvas mounted). See ADR-CRDT-PLACEMENT-0035.
 */
export interface SemanticPlacementPort {
  nodeBounds(scope: GraphScope, nodeId: NodeId): PlacementRect | null
  viewportBounds(scope: GraphScope): PlacementRect | null
}

type LiveWidgetMutationResult =
  | { status: 'skipped' }
  | { status: 'applied'; resolvedValue: WidgetValue }
  | { status: 'rolledBack'; resolvedValue: WidgetValue }

/**
 * Renderer-owned live widget port. A value patch for a widget that is already
 * mounted on the canvas is replayed through the live widget so its callback,
 * backing property, and rendered state move in the same frame; the port
 * reports the value the live widget settled on, or `skipped` when the node or
 * widget is not live.
 */
interface SemanticLiveWidgetMutationPort {
  setValue(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue,
    context: RemoteMutationContext
  ): LiveWidgetMutationResult
  rebind?(scope: GraphScope, nodeId: NodeId, name: string): void
}

/**
 * The live node's answer for whether `name` is a member of one of its
 * autogrow groups. `unavailable` means the node itself couldn't be asked
 * (unmounted, background workflow) and carries no opinion either way; only
 * `member`/`notMember` are the node's own real provenance from its
 * `comfyDynamic.autogrow` registration. Callers must never treat
 * `unavailable` as an authoritative "no"; `resolveAutogrowGroup` (in
 * `createGraphMutations`) falls back first to its own remembered answer
 * from an earlier `member`/`notMember` for the same node and name, and only
 * to `nameShapeAutogrowGroupOf`'s inference when it has never resolved that
 * name definitively either.
 */
export type LiveAutogrowGroupAnswer =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'member'; readonly group: string }
  | { readonly kind: 'notMember' }

/**
 * Renderer-owned live node query port. Answers whether an input name is a
 * member of one of the live node's own autogrow groups -- real provenance
 * from the node's `comfyDynamic.autogrow` registration, rather than
 * `nameShapeAutogrowGroupOf`'s inference from the name's shape. See
 * {@link LiveAutogrowGroupAnswer} for what each result means.
 */
export interface SemanticLiveNodeQueryPort {
  autogrowGroupOf(
    scope: GraphScope,
    nodeId: NodeId,
    name: string
  ): LiveAutogrowGroupAnswer
}

export interface GraphMutationBatch {
  addNode(payload: SemanticNodePayload): void
  /**
   * For a node of the same type, resyncs fields and slots and patches widget
   * values onto the registered widgets. A missing node or type mismatch is
   * added or replaced from the full payload.
   */
  reconcileNode(payload: SemanticNodePayload): void
  /** Like `reconcileNode`, but the live node keeps its slot list. */
  reconcileNodeFields(payload: SemanticNodePayload): void
  setWidget(nodeId: NodeId, name: string, value: unknown): void
  connect(link: SemanticLinkPayload): void
  /** Derived cleanup for an authoritative snapshot; not a wire op. */
  removeMissing(
    retainedNodeIds: readonly NodeId[],
    retainedLinkIds: readonly number[]
  ): void
  /** Derived removals emitted by connect/delete effects; not a wire op. */
  removeLinks(linkIds: readonly number[]): void
  deleteNode(nodeId: NodeId, removedLinkIds?: readonly number[]): void
  clearSemanticGraph(): void
}

export interface GraphMutations {
  batch(
    context: RemoteMutationContext,
    define: (batch: GraphMutationBatch) => void
  ): boolean
  addNode(payload: SemanticNodePayload, context: RemoteMutationContext): boolean
  setWidget(
    nodeId: NodeId,
    name: string,
    value: unknown,
    context: RemoteMutationContext
  ): boolean
  connect(link: SemanticLinkPayload, context: RemoteMutationContext): boolean
  deleteNode(
    nodeId: NodeId,
    removedLinkIds: readonly number[],
    context: RemoteMutationContext
  ): boolean
  clearSemanticGraph(context: RemoteMutationContext): boolean
}

export interface GraphMutationsDeps {
  getScope(): GraphScope | null
  layout: SemanticLayoutMutationPort
  placement: SemanticPlacementPort
  liveWidgets?: SemanticLiveWidgetMutationPort
  liveNodes?: SemanticLiveNodeQueryPort
}

type QueuedMutation =
  | { kind: 'addNode'; payload: SemanticNodePayload }
  | { kind: 'reconcileNode'; payload: SemanticNodePayload }
  | { kind: 'reconcileNodeFields'; payload: SemanticNodePayload }
  | { kind: 'setWidget'; nodeId: NodeId; name: string; value: unknown }
  | { kind: 'connect'; link: SemanticLinkPayload }
  | {
      kind: 'removeMissing'
      retainedNodeIds: readonly NodeId[]
      retainedLinkIds: readonly number[]
    }
  | { kind: 'removeLinks'; linkIds: readonly number[] }
  | {
      kind: 'deleteNode'
      nodeId: NodeId
      removedLinkIds: readonly number[]
    }
  | { kind: 'clearSemanticGraph' }

interface PreparedNode {
  state: NodeState
  layout: SemanticNodeLayout
  widgets: WidgetValuePayload
}

type PreparedMutation =
  | {
      kind: 'addNode'
      node: PreparedNode
      queued: 'addNode' | 'reconcileNodeFields'
    }
  | { kind: 'reconcileNode'; node: PreparedNode }
  | { kind: 'replaceNode'; node: PreparedNode }
  | {
      kind: 'reconcileNodeFields'
      state: NodeState
      widgets: WidgetValuePayload
    }
  | { kind: 'setWidget'; nodeId: NodeId; name: string; value: WidgetValue }
  | {
      kind: 'connect'
      topology: LinkTopology
      originOutputs?: NodeState['outputs']
      targetInputs?: NodeState['inputs']
    }
  | {
      kind: 'removeMissing'
      nodeIds: readonly NodeId[]
      linkIds: readonly LinkId[]
    }
  | { kind: 'removeLinks'; linkIds: readonly LinkId[] }
  | {
      kind: 'deleteNode'
      nodeId: NodeId
      removedLinkIds: readonly LinkId[]
    }
  | { kind: 'clearSemanticGraph'; nodeIds: readonly NodeId[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? structuredClone(value) : {}
}

/**
 * `ghost` marks a node still following the cursor during search-box placement.
 * The placement click clears it locally and mints no op, so a document that
 * recorded the flag would resurrect it here and leave an already-placed node
 * translucent and unclickable.
 */
function cloneNodeFlags(value: unknown): Record<string, unknown> {
  const { ghost: _ghost, ...flags } = cloneRecord(value)
  return flags
}

/**
 * A supplied input slot whose record has no `link` key carries no link
 * information (as opposed to `link: null`, which means unlinked). Such slots
 * keep the link of the `existing` slot at the same index, or `null` when the
 * node has no slot there yet.
 */
function applySlotLink(
  slot: Record<string, unknown>,
  index: number,
  existing?: readonly (NodeState['inputs'][number] | undefined)[]
): void {
  if (typeof slot.link === 'number') {
    slot.link = toLinkId(slot.link)
    return
  }
  if (slot.link === undefined) slot.link = existing?.[index]?.link ?? null
}

/**
 * The CRDT payload never carries the autogrow-computed display name, so a
 * prior slot at the same index and name (i.e. this is a reconcile of a slot
 * the live node already has, not a genuinely new one) keeps its display
 * metadata instead of losing it to the thin payload.
 */
function preserveSlotDisplayMetadata(
  slot: Record<string, unknown>,
  priorSlot?: NodeState['inputs'][number]
): void {
  if (!priorSlot || priorSlot.name !== slot.name) return
  if (slot.localized_name === undefined)
    slot.localized_name = priorSlot.localized_name
  if (slot.label === undefined) slot.label = priorSlot.label
}

function prepareInputSlot(
  raw: Record<string, unknown>,
  index: number,
  existing?: readonly (NodeState['inputs'][number] | undefined)[]
): NodeState['inputs'][number] {
  const slot = structuredClone(raw)
  applySlotLink(slot, index, existing)
  preserveSlotDisplayMetadata(slot, existing?.[index])
  return {
    ...slot,
    boundingRect: [0, 0, 0, 0]
  } as unknown as NodeState['inputs'][number]
}

function prepareInputSlots(
  value: unknown,
  existing?: readonly (NodeState['inputs'][number] | undefined)[]
): NodeState['inputs'] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((raw, index) => prepareInputSlot(raw, index, existing))
}

function prepareOutputSlots(value: unknown): NodeState['outputs'] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((raw) => {
    const slot = structuredClone(raw)
    if (Array.isArray(slot.links)) {
      slot.links = slot.links.map((id) => toLinkId(Number(id)))
    }
    return {
      ...slot,
      boundingRect: [0, 0, 0, 0]
    } as unknown as NodeState['outputs'][number]
  })
}

/**
 * A live node's input set can diverge from the document two ways: it grew
 * (autogrow appended a member, not yet named by the document) or it changed
 * for some other reason (a rename, a definition change, or autogrow itself
 * removing a member on disconnect/shrink). `mergeInputSlotsByName` only
 * merges by name on the growth path: every document input still exists
 * live, and any live-only leftover is an unlinked, autogrow-shaped spare.
 * `hasNonGrowthInputSetChange` (below) detects the other path -- the
 * document naming something live doesn't have, or live keeping a leftover
 * that is linked or not autogrow-shaped -- in which case the document is
 * authoritative and the merge falls back to positional preparation, letting
 * stale live slots go.
 */
function hasNonGrowthInputSetChange(
  live: NodeState['inputs'],
  documentInputs: Record<string, unknown>[],
  autogrowGroupOf: (name: unknown) => string | undefined
): boolean {
  const liveCounts = new Map<unknown, number>()
  for (const input of live) {
    liveCounts.set(input.name, (liveCounts.get(input.name) ?? 0) + 1)
  }
  const documentCounts = new Map<unknown, number>()
  for (const slot of documentInputs) {
    documentCounts.set(slot.name, (documentCounts.get(slot.name) ?? 0) + 1)
  }
  // litegraph does not enforce unique names, so "the document has a name
  // live doesn't" also covers asking for more copies of a shared name than
  // live has.
  const documentExceedsLive = [...documentCounts].some(
    ([name, count]) => count > (liveCounts.get(name) ?? 0)
  )
  // Consumes one document occurrence per live occurrence of the same name,
  // in live order, so a repeated name is matched pairwise rather than by a
  // presence check. Any live occurrence left unmatched is tolerated only
  // when it is both unlinked and autogrow-shaped (see the contract above).
  const remainingByName = new Map(documentCounts)
  const liveOnlyIsUnaccountedFor = live.some((input) => {
    const remaining = remainingByName.get(input.name) ?? 0
    if (remaining > 0) {
      remainingByName.set(input.name, remaining - 1)
      return false
    }
    if (input.link !== null) return true
    return autogrowGroupOf(input.name) === undefined
  })
  return documentExceedsLive || liveOnlyIsUnaccountedFor
}

/**
 * Whether the node TYPE's own static definition has an opinion on `name`'s
 * autogrow membership -- and, when it does, what that opinion is. `known:
 * false` means the type itself hasn't loaded into `useNodeDefStore()` yet,
 * so this has no evidence either way and the name-shape heuristic is the
 * only option left. `known: true` means the type's full, authoritative set
 * of `COMFY_AUTOGROW_V3` groups is available, so `group: undefined` is a
 * real "not a member of any of them" -- not "unknown" -- exactly like a
 * live node's own `notMember` answer.
 */
type NodeDefAutogrowAnswer =
  | { readonly known: false }
  | { readonly known: true; readonly group: string | undefined }

/**
 * `ComfyNodeDefImpl.inputs` is `Record<string, InputSpecV2>`, which this
 * project's TypeScript config (`noUncheckedIndexedAccess` is off) types as
 * always present, even though a candidate group name commonly has no
 * matching input. Matches `nodeDefStore.ts`'s own `getInputSpecForWidget`,
 * which widens the same access through a declared `| undefined` return
 * type, so callers get an honest optional instead of a type-checker-only
 * guarantee the runtime doesn't share.
 */
function nodeDefInputSpec(
  nodeDef: ComfyNodeDefImpl,
  name: string
): InputSpecV2 | undefined {
  return nodeDef.inputs[name]
}

/**
 * Reads the same `COMFY_AUTOGROW_V3` registration `SemanticLiveNodeQueryPort`
 * would, off the node TYPE's own static definition rather than a live
 * instance -- real provenance, just as authoritative as a live answer,
 * since a live node's `comfyDynamic.autogrow` registration is itself built
 * from exactly this data (`dynamicWidgets.ts`'s `applyAutogrow` parses the
 * same input spec this function reads). It is available whenever the
 * type's definition has loaded, independent of whether any live instance
 * of the node exists to ask -- which is what lets `resolveAutogrowGroup`
 * (in `createGraphMutations`) classify a node correctly even the very
 * first time it ever reconciles that node while the live port answers
 * `unavailable` and this follower has no remembered answer yet.
 */
function nodeDefAutogrowGroupOf(
  nodeType: string,
  name: string
): NodeDefAutogrowAnswer {
  const nodeDef = useNodeDefStore().getNodeDefByName(nodeType)
  if (!nodeDef) return { known: false }
  const dot = name.lastIndexOf('.')
  if (dot < 0) return { known: true, group: undefined }
  const groupName = name.slice(0, dot)
  const key = name.slice(dot + 1)
  const inputSpec = nodeDefInputSpec(nodeDef, groupName)
  const template =
    inputSpec && zAutogrowOptions.safeParse(inputSpec).data?.template
  if (!template) return { known: true, group: undefined }
  const isMember = isAutogrowGroupMember(key, template.names)
  return { known: true, group: isMember ? groupName : undefined }
}

/**
 * The group prefix of a live-only input shaped like an autogrow member's
 * DEFAULT naming (`group.prefixN`, ending in the member's ordinal) --
 * undefined for anything else.
 *
 * LAST RESORT: used only once both the live node (`SemanticLiveNodeQueryPort`)
 * and the node type's own static definition (`nodeDefAutogrowGroupOf`) have
 * no opinion -- e.g. the type hasn't loaded yet. A `NodeState` input itself
 * carries no autogrow marker, so absent either real answer this is
 * inference from shape alone, and shape is not a reliable signal in either
 * direction:
 *
 * - False positive: `group.member` alone is not enough, because
 *   `dynamicWidgets.ts`'s `COMFY_DYNAMICCOMBO_V3` support (`updateWidgets`)
 *   mints the exact same `${widget.name}.${key}` shape for an unrelated
 *   reason, where `key` is an ordinary schema field name (e.g.
 *   `mode.strength`), not an ordinal. Requiring a trailing digit rules that
 *   out for the common case, but a coincidentally-numeric DynamicCombo key
 *   (e.g. a name ending `...0.0.0.0`) still passes it and is wrongly kept.
 * - False negative: an autogrow group defined with an explicit, non-numeric
 *   `names` list (`dynamicWidgets.ts`'s `resolveAutogrowOrdinal` matches
 *   those by name, not by trailing ordinal) produces member names that
 *   don't end in a digit at all, and are wrongly dropped as if they were an
 *   ordinary input the document removed.
 *
 * Both failure directions are real, and neither is fixable by refining the
 * name-shape rule further -- the same suffix shape is genuinely ambiguous
 * between "autogrow ordinal" and "unrelated dotted name" without the
 * node's own group registration, live or from its type definition. This
 * fallback stays strictly safer than over-retaining in the one case this
 * layer can always tell apart (an ordinary, non-dotted extra input).
 */
function nameShapeAutogrowGroupOf(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined
  const dot = name.lastIndexOf('.')
  if (dot < 0 || !isAutogrowGroupMember(name.slice(dot + 1), undefined))
    return undefined
  return name.slice(0, dot)
}

function mergeInputSlotsByName(
  live: NodeState['inputs'],
  supplied: unknown,
  autogrowGroupOf: (name: unknown) => string | undefined
): NodeState['inputs'] {
  const documentInputs = Array.isArray(supplied)
    ? supplied.filter(isRecord)
    : []
  // Each live occurrence is consumed at most once, in document order: with
  // two same-named live slots and two document entries sharing that name,
  // the first document entry falls back to the first live slot and the
  // second to the second, rather than both re-finding the same (first) live
  // slot and losing whatever link/value only the second live slot carried.
  const consumedLive = new Set<number>()
  const liveByName = documentInputs.map((slot) => {
    const index = live.findIndex(
      (input, i) => !consumedLive.has(i) && input.name === slot.name
    )
    if (index < 0) return undefined
    consumedLive.add(index)
    return live[index]
  })
  // The document names something this node does not have (including asking
  // for more copies of a shared name than live has), or the node kept a
  // live-only slot that still carries a link the document doesn't: either
  // way the input set changed, so the document decides the list positionally.
  if (hasNonGrowthInputSetChange(live, documentInputs, autogrowGroupOf)) {
    return prepareInputSlots(documentInputs, live)
  }
  const merged = [...live]
  // Litegraph does not enforce unique input names, so each merged slot is
  // consumed at most once — otherwise two document inputs sharing a name
  // would both resolve to the same merged index and one would be dropped.
  const used = new Set<number>()
  for (const input of prepareInputSlots(documentInputs, liveByName)) {
    const index = merged.findIndex(
      (local, i) => !used.has(i) && local.name === input.name
    )
    if (index < 0) merged.push(input)
    else {
      used.add(index)
      merged[index] = input
    }
  }
  return merged
}

type ConnectTargetSlotResolution =
  | { readonly error: string }
  | {
      readonly targetInputs: NodeState['inputs']
      readonly targetSlot: number
    }

/**
 * Merges a `connect` payload's raw target inputs onto the live target node
 * and resolves which merged slot `rawTargetSlot` (the payload's own index,
 * pre-merge) now corresponds to, or an error string when that slot cannot
 * be identified. Split out of `prepare`'s `connect` case, whose own
 * complexity is otherwise dominated by this one slot's worth of resolution
 * logic rather than by the mutation dispatch it exists to do.
 */
function resolveConnectTargetInputs(
  liveInputs: NodeState['inputs'],
  rawTargetInputs: readonly ISerialisableNodeInput[],
  rawTargetSlot: number,
  autogrowGroupOf: (name: unknown) => string | undefined
): ConnectTargetSlotResolution {
  if (liveInputs.some((input) => !isSlotRecord(input))) {
    return { error: 'connect target inputs contain a malformed live slot' }
  }
  // Index the raw payload, not a filtered copy of it: dropping malformed
  // entries first would shift every later index and resolve the wrong
  // slot's name.
  const rawTarget = rawTargetInputs[rawTargetSlot]
  const name = isRecord(rawTarget) ? rawTarget.name : undefined
  if (typeof name !== 'string') {
    return { error: `connect target slot ${rawTargetSlot} does not exist` }
  }
  // The payload's own slot names are not guaranteed unique, so the target
  // slot is resolved by occurrence -- the Nth slot named `name` up to
  // `rawTargetSlot` in the raw payload maps to the Nth slot named `name` in
  // the merged result -- rather than by first match.
  const occurrence = rawTargetInputs
    .slice(0, rawTargetSlot)
    .filter(
      (candidate) => isRecord(candidate) && candidate.name === name
    ).length
  const targetInputs = mergeInputSlotsByName(
    liveInputs,
    rawTargetInputs,
    autogrowGroupOf
  )
  let seen = 0
  let resolvedSlot = -1
  for (const [index, input] of targetInputs.entries()) {
    if (input.name !== name) continue
    if (seen === occurrence) {
      resolvedSlot = index
      break
    }
    seen++
  }
  if (resolvedSlot < 0) {
    return { error: `connect target slot ${rawTargetSlot} does not exist` }
  }
  return { targetInputs, targetSlot: resolvedSlot }
}

function readPair(
  value: unknown,
  fallback: readonly [number, number]
): readonly [number, number] {
  if (!Array.isArray(value) || value.length < 2) return fallback
  const first = Number(value[0])
  const second = Number(value[1])
  return Number.isFinite(first) && Number.isFinite(second)
    ? [first, second]
    : fallback
}

type NodeColors = Pick<NodeState, 'bgcolor' | 'boxcolor' | 'color'>

function resolveColorField(
  value: unknown,
  existing?: string
): string | undefined {
  return typeof value === 'string' ? value : existing
}

/**
 * Node color is a client-only presentation property the CRDT document never
 * carries (see ComfyNode's constructor), so a payload without it keeps the
 * live node's color instead of losing it to a reconcile.
 */
function resolveNodeColors(
  payload: SemanticNodePayload,
  existing?: NodeState
): Partial<NodeColors> {
  const bgcolor = resolveColorField(payload.bgcolor, existing?.bgcolor)
  const boxcolor = resolveColorField(payload.boxcolor, existing?.boxcolor)
  const color = resolveColorField(payload.color, existing?.color)
  return {
    ...(bgcolor !== undefined && { bgcolor }),
    ...(boxcolor !== undefined && { boxcolor }),
    ...(color !== undefined && { color })
  }
}

type NodeDisplayFlags = Pick<NodeState, 'resizable' | 'shape' | 'showAdvanced'>

function resolveNodeDisplayFlags(
  payload: SemanticNodePayload
): Partial<NodeDisplayFlags> {
  return {
    ...(typeof payload.resizable === 'boolean' && {
      resizable: payload.resizable
    }),
    ...(typeof payload.shape === 'number' && {
      shape: payload.shape
    }),
    ...(typeof payload.showAdvanced === 'boolean' && {
      showAdvanced: payload.showAdvanced
    })
  }
}

function prepareNode(
  payload: SemanticNodePayload,
  scope: GraphScope,
  existing?: NodeState
): PreparedNode {
  const incumbent = existing?.type === payload.type ? existing : undefined
  const id = toNodeId(payload.id)
  const [x, y] = readPair(payload.pos, [0, 0])
  const [width, height] = readPair(payload.size, [270, 100])
  const mode = Number(payload.mode)
  const flags = cloneNodeFlags(payload.flags)
  const state: NodeState = {
    id,
    graphId: scope.owningGraphId,
    type: payload.type,
    title: nodeTitle(payload.title, payload.type),
    flags,
    inputs: prepareInputSlots(payload.inputs, incumbent?.inputs),
    outputs: prepareOutputSlots(payload.outputs),
    mode: Number.isInteger(mode) ? mode : 0,
    properties: cloneRecord(payload.properties) as NodeState['properties'],
    lastSerialization: structuredClone({
      ...payload,
      flags
    }) as unknown as ISerialisedNode,
    ...resolveNodeColors(payload, incumbent),
    ...resolveNodeDisplayFlags(payload)
  }
  return {
    state,
    widgets: parseWidgetValues(payload.widgets_values),
    layout: {
      position: { x, y },
      size: { width, height }
    }
  }
}

function prepareTopology(
  payload: SemanticLinkPayload,
  scope: GraphScope
): LinkTopology {
  return {
    id: toLinkId(payload.id),
    graphId: scope.owningGraphId,
    originNodeId: toNodeId(payload.originNodeId),
    originSlot: payload.originSlot,
    targetNodeId: toNodeId(payload.targetNodeId),
    targetSlot: payload.targetSlot,
    type: payload.type
  }
}

function nodeKey(nodeId: NodeId): string {
  return String(nodeId)
}

/**
 * Whether a link's declared origin output type and target input type are
 * both resolvable and definitively incompatible, using the exact rule
 * `connect` enforces before applying a link (`LiteGraph.isValidConnection`).
 * An unresolvable slot (missing slot list, or an index past its end) reports
 * `false` rather than `true`: `connect`'s own "does not exist" checks give
 * that case a more specific rejection reason, and this predicate exists only
 * to let a caller pre-exclude a link it already knows would be refused for
 * an origin/target TYPE mismatch, not to duplicate every reason `connect`
 * can refuse a link.
 *
 * Exposed so `EcsFollowerAdapter` can keep an already-invalid retained link
 * out of what it projects into the local canvas mirror during
 * reconciliation, without duplicating `LiteGraph`'s compatibility rules or
 * risking them drifting from what `connect` actually enforces.
 */
export function isIncompatibleLinkType(link: {
  originSlot: number
  targetSlot: number
  originOutputs?: readonly ISerialisableNodeOutput[]
  targetInputs?: readonly ISerialisableNodeInput[]
}): boolean {
  const originType = link.originOutputs?.[link.originSlot]?.type
  const targetType = link.targetInputs?.[link.targetSlot]?.type
  if (originType === undefined || targetType === undefined) return false
  return !LiteGraph.isValidConnection(originType, targetType)
}

function detachedLinkSlots(
  nodes: Iterable<NodeState>,
  topology: LinkTopology
): Map<NodeId, Pick<NodeState, 'inputs' | 'outputs'>> {
  const nodesById = new Map([...nodes].map((node) => [nodeKey(node.id), node]))
  const changed = new Map<NodeId, Pick<NodeState, 'inputs' | 'outputs'>>()
  const slotsFor = (node: NodeState) => {
    const prior = changed.get(node.id)
    if (prior) return prior
    const slots = { inputs: node.inputs, outputs: node.outputs }
    changed.set(node.id, slots)
    return slots
  }

  const origin = nodesById.get(nodeKey(topology.originNodeId))
  if (origin?.outputs[topology.originSlot]) {
    const slots = slotsFor(origin)
    slots.outputs = slots.outputs.map((output, index) =>
      index === topology.originSlot && isPlainObject(output)
        ? {
            ...output,
            links: output.links?.filter((id) => id !== topology.id) ?? null
          }
        : output
    )
  }

  const target = nodesById.get(nodeKey(topology.targetNodeId))
  if (target?.inputs[topology.targetSlot]?.link === topology.id) {
    const slots = slotsFor(target)
    slots.inputs = slots.inputs.map((input, index) =>
      index === topology.targetSlot && isPlainObject(input)
        ? { ...input, link: null }
        : input
    )
  }

  return changed
}

function removeIncidentLinks(
  nodes: Map<string, NodeState>,
  links: Map<LinkId, LinkTopology>,
  nodeId: NodeId
): void {
  for (const [id, topology] of [...links]) {
    if (topology.originNodeId === nodeId || topology.targetNodeId === nodeId) {
      removeSimulatedLink(nodes, links, id)
    }
  }
}

function removeSimulatedLink(
  nodes: Map<string, NodeState>,
  links: Map<LinkId, LinkTopology>,
  linkId: LinkId
): void {
  const topology = links.get(linkId)
  if (!topology) return
  links.delete(linkId)
  for (const [nodeId, slots] of detachedLinkSlots(nodes.values(), topology)) {
    const node = nodes.get(nodeKey(nodeId))
    if (node) nodes.set(nodeKey(nodeId), { ...node, ...slots })
  }
}

/**
 * Builds the graph-scoped composite used by the remote follower. Every batch
 * is validated against a simulated final store state before its first write;
 * the synchronous commit then uses explicit remote IDs and call-carried
 * provenance on every participating store action.
 */
export function createGraphMutations(deps: GraphMutationsDeps): GraphMutations {
  const nodeStore = useNodeDataStore()
  const linkStore = useLinkStore()
  const linkPresentationStore = useLinkPresentationStore()
  const widgetStore = useWidgetValueStore()

  // This follower's own memory of a live `member`/`notMember` autogrow
  // answer, keyed by node, then input name, then the node TYPE it was
  // answered for (`undefined` stored as `null` recorded a definitive "not
  // a member", as opposed to no entry at all, which means never resolved).
  // It exists so a later reconcile that finds the live node `unavailable`
  // (unmounted, background workflow) can prefer this follower's own prior,
  // real provenance over guessing from the name's shape again -- the same
  // "carry it forward in the store we already control" approach
  // `preserveSlotDisplayMetadata` takes for `localized_name`/`label`. The
  // node type is part of the key because a node ID can be reused for a
  // different type (replace, or a same-named type re-registered with a
  // different schema): an answer recorded under the old type must never
  // win for the new one, so a type mismatch reads back as "never
  // resolved" rather than resurrecting the stale answer. It is scoped to
  // this `GraphMutations` instance (one per follower), not the module, so
  // distinct followers -- and distinct tests -- never see each other's
  // memory.
  const rememberedAutogrowGroups = new Map<
    string,
    Map<string, { nodeType: string; group: string | null }>
  >()

  function rememberAutogrowGroup(
    nodeId: NodeId,
    nodeType: string,
    name: string,
    group: string | undefined
  ): void {
    const key = nodeKey(nodeId)
    let forNode = rememberedAutogrowGroups.get(key)
    if (!forNode) {
      forNode = new Map()
      rememberedAutogrowGroups.set(key, forNode)
    }
    forNode.set(name, { nodeType, group: group ?? null })
  }

  // Distinguishes "never resolved" (the caller should fall back to the
  // name-shape heuristic) from a remembered, definitive `notMember`
  // (`group: undefined`, but resolved -- the caller must trust that "no"
  // and not let the heuristic override it). An entry recorded for a
  // different node type also reads back as "never resolved".
  function rememberedAutogrowGroup(
    nodeId: NodeId,
    nodeType: string,
    name: string
  ): { remembered: true; group: string | undefined } | { remembered: false } {
    const remembered = rememberedAutogrowGroups.get(nodeKey(nodeId))?.get(name)
    if (!remembered || remembered.nodeType !== nodeType) {
      return { remembered: false }
    }
    return { remembered: true, group: remembered.group ?? undefined }
  }

  function forgetAutogrowGroups(nodeId: NodeId): void {
    rememberedAutogrowGroups.delete(nodeKey(nodeId))
  }

  // Prefers the live node's own autogrow group registration (real
  // provenance) over every fallback below. Trusts a `member`/`notMember`
  // answer as authoritative and final, and remembers it (see
  // `rememberAutogrowGroup`) so a later call for the same node and name
  // can still use it once the live port stops being able to answer.
  //
  // The fallbacks run only when the live port itself has no opinion, i.e.
  // no port is wired at all, or the wired port answers `unavailable` (the
  // live node couldn't be asked, not that it was asked and said no) -- see
  // `SemanticLiveNodeQueryPort`/`LiveAutogrowGroupAnswer`. This follower's
  // own memory of an earlier definitive answer for the exact same node and
  // name is preferred first, since it is real provenance the node already
  // gave, just not right now. Absent that memory too -- including on this
  // follower's very first reconcile of the node, before it has ever had a
  // chance to ask the live node anything -- `nodeDefAutogrowGroupOf` reads
  // the same registration `SemanticLiveNodeQueryPort` would, off the node
  // TYPE's own static definition rather than a live instance, so it is
  // equally real provenance and does not depend on the node being live at
  // all. `nameShapeAutogrowGroupOf` is the true last resort, guessing from
  // the name's shape, for a name neither of those has ever resolved.
  //
  // Defined here, alongside the memory it reads, rather than inside
  // `prepare` (its only caller): a closure nested in `prepare`'s own body
  // adds its branches to `prepare`'s complexity score, even though none of
  // them depend on anything `prepare` computes beyond `scope`/`nodeType`,
  // which it takes as parameters instead.
  function resolveAutogrowGroup(
    scope: GraphScope,
    nodeId: NodeId,
    nodeType: string,
    name: unknown
  ): string | undefined {
    if (typeof name !== 'string') return undefined
    const fallback = (): string | undefined => {
      const memory = rememberedAutogrowGroup(nodeId, nodeType, name)
      if (memory.remembered) return memory.group
      const fromDef = nodeDefAutogrowGroupOf(nodeType, name)
      return fromDef.known ? fromDef.group : nameShapeAutogrowGroupOf(name)
    }
    if (!deps.liveNodes) return fallback()
    const answer = deps.liveNodes.autogrowGroupOf(scope, nodeId, name)
    switch (answer.kind) {
      case 'member':
        rememberAutogrowGroup(nodeId, nodeType, name, answer.group)
        return answer.group
      case 'notMember':
        rememberAutogrowGroup(nodeId, nodeType, name, undefined)
        return undefined
      case 'unavailable':
        return fallback()
    }
  }

  function fail(message: string): false {
    console.error(`[agent-crdt] graph mutation rejected: ${message}`)
    return false
  }

  function prepare(
    scope: GraphScope,
    queued: readonly QueuedMutation[]
  ): PreparedMutation[] | string {
    const nodes = new Map(
      nodeStore
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map((node) => [nodeKey(node.id), node])
    )
    const links = new Map(
      [...linkStore.graphTopologies(scope)].map((link) => [link.id, link])
    )
    const validateNodeUpsert = (
      node: PreparedNode,
      key: string
    ): string | undefined => {
      const incumbent = nodeStore.getNode(scope.rootGraphId, node.state.id)
      if (incumbent && incumbent.graphId !== scope.owningGraphId) {
        return `node id ${key} belongs to graph ${incumbent.graphId}`
      }
      if (
        node.widgets.kind === 'named' &&
        [...node.widgets.values.keys()].some(
          (name) =>
            !isWidgetId(widgetId(scope.rootGraphId, node.state.id, name))
        )
      ) {
        return `node ${key} has an invalid widget name`
      }
    }

    const prepared: PreparedMutation[] = []
    for (const mutation of queued) {
      switch (mutation.kind) {
        case 'addNode':
        case 'reconcileNode': {
          if (
            (typeof mutation.payload.id !== 'string' &&
              typeof mutation.payload.id !== 'number') ||
            typeof mutation.payload.type !== 'string' ||
            mutation.payload.type.length === 0
          ) {
            return 'addNode requires a payload id and type'
          }
          const node = prepareNode(
            mutation.payload,
            scope,
            nodes.get(nodeKey(toNodeId(mutation.payload.id)))
          )
          const key = nodeKey(node.state.id)
          const existing = nodes.get(key)
          const validationError = validateNodeUpsert(node, key)
          if (validationError) return validationError
          if (mutation.kind === 'addNode' && nodes.has(key)) {
            return `node id ${key} is already registered`
          }
          if (
            mutation.kind === 'reconcileNode' &&
            existing &&
            existing.type === node.state.type
          ) {
            if (existing.inputs.some((input) => !isSlotRecord(input))) {
              return 'reconcile target inputs contain a malformed live slot'
            }
            node.state.inputs = mergeInputSlotsByName(
              existing.inputs,
              mutation.payload.inputs,
              (name) =>
                resolveAutogrowGroup(
                  scope,
                  node.state.id,
                  node.state.type,
                  name
                )
            )
          }
          nodes.set(key, node.state)
          if (mutation.kind === 'addNode') {
            prepared.push({ kind: 'addNode', node, queued: 'addNode' })
          } else {
            prepared.push({
              kind:
                existing && existing.type !== node.state.type
                  ? 'replaceNode'
                  : 'reconcileNode',
              node
            })
          }
          break
        }
        case 'reconcileNodeFields': {
          if (
            (typeof mutation.payload.id !== 'string' &&
              typeof mutation.payload.id !== 'number') ||
            typeof mutation.payload.type !== 'string' ||
            mutation.payload.type.length === 0
          ) {
            return 'reconcileNodeFields requires a payload id and type'
          }
          const key = nodeKey(toNodeId(mutation.payload.id))
          const existing = nodes.get(key)
          const node = prepareNode(mutation.payload, scope, existing)
          if (!existing || existing.type !== node.state.type) {
            const validationError = validateNodeUpsert(node, key)
            if (validationError) return validationError
            nodes.set(key, node.state)
            if (existing) {
              prepared.push({ kind: 'replaceNode', node })
            } else {
              prepared.push({
                kind: 'addNode',
                node,
                queued: 'reconcileNodeFields'
              })
            }
          } else {
            node.state.inputs = existing.inputs
            node.state.outputs = existing.outputs
            nodes.set(key, node.state)
            prepared.push({
              kind: mutation.kind,
              state: node.state,
              widgets: node.widgets
            })
          }
          break
        }
        case 'setWidget': {
          const key = nodeKey(mutation.nodeId)
          if (!nodes.has(key)) return `node ${key} does not exist`
          if (
            !isWidgetId(
              widgetId(scope.rootGraphId, mutation.nodeId, mutation.name)
            )
          ) {
            return `node ${key} has an invalid widget name`
          }
          prepared.push({
            kind: mutation.kind,
            nodeId: mutation.nodeId,
            name: mutation.name,
            value: cloneWidgetValue(mutation.value)
          })
          break
        }
        case 'connect': {
          if (
            !Number.isInteger(mutation.link.id) ||
            mutation.link.id < 0 ||
            !Number.isInteger(mutation.link.originSlot) ||
            mutation.link.originSlot < 0 ||
            !Number.isInteger(mutation.link.targetSlot) ||
            mutation.link.targetSlot < 0
          ) {
            return 'connect requires non-negative integer ids and slots'
          }
          const topology = prepareTopology(mutation.link, scope)
          const incumbent = linkStore.getTopology(
            scope.rootGraphId,
            topology.id
          )
          if (incumbent && incumbent.graphId !== scope.owningGraphId) {
            return `link id ${topology.id} belongs to graph ${incumbent.graphId}`
          }
          const origin = nodes.get(nodeKey(topology.originNodeId))
          if (!origin) {
            return `connect origin node ${topology.originNodeId} does not exist`
          }
          const target = nodes.get(nodeKey(topology.targetNodeId))
          if (!target) {
            return `connect target node ${topology.targetNodeId} does not exist`
          }
          const originOutputs = mutation.link.originOutputs
            ? prepareOutputSlots(mutation.link.originOutputs)
            : origin.outputs
          let targetInputs = target.inputs
          if (mutation.link.targetInputs) {
            const resolution = resolveConnectTargetInputs(
              target.inputs,
              mutation.link.targetInputs,
              topology.targetSlot,
              (candidateName) =>
                resolveAutogrowGroup(
                  scope,
                  topology.targetNodeId,
                  target.type,
                  candidateName
                )
            )
            if ('error' in resolution) return resolution.error
            targetInputs = resolution.targetInputs
            topology.targetSlot = resolution.targetSlot
          }
          if (topology.originSlot >= originOutputs.length) {
            return `connect origin slot ${topology.originSlot} does not exist`
          }
          if (topology.targetSlot >= targetInputs.length) {
            return `connect target slot ${topology.targetSlot} does not exist`
          }
          const originType = originOutputs[topology.originSlot]?.type
          const targetType = targetInputs[topology.targetSlot]?.type
          if (
            isIncompatibleLinkType({
              originSlot: topology.originSlot,
              targetSlot: topology.targetSlot,
              originOutputs,
              targetInputs
            })
          ) {
            return `connect origin slot ${topology.originSlot} type ${String(originType)} is not compatible with target slot ${topology.targetSlot} type ${String(targetType)}`
          }
          if (mutation.link.originOutputs) {
            nodes.set(nodeKey(topology.originNodeId), {
              ...origin,
              outputs: originOutputs
            })
          }
          if (mutation.link.targetInputs) {
            const currentTarget =
              nodes.get(nodeKey(topology.targetNodeId)) ?? target
            nodes.set(nodeKey(topology.targetNodeId), {
              ...currentTarget,
              inputs: targetInputs
            })
          }
          links.delete(topology.id)
          for (const [id, incumbent] of links) {
            if (
              incumbent.targetNodeId === topology.targetNodeId &&
              incumbent.targetSlot === topology.targetSlot
            ) {
              links.delete(id)
            }
          }
          links.set(topology.id, topology)
          prepared.push({
            kind: mutation.kind,
            topology,
            ...(mutation.link.originOutputs && {
              originOutputs
            }),
            ...(mutation.link.targetInputs && {
              targetInputs
            })
          })
          break
        }
        case 'removeMissing': {
          const retainedNodeIds = new Set(mutation.retainedNodeIds.map(nodeKey))
          const retainedLinkIds = new Set<LinkId>()
          for (const value of mutation.retainedLinkIds) {
            if (!Number.isInteger(value) || value < 0) {
              return 'removeMissing requires non-negative integer link ids'
            }
            retainedLinkIds.add(toLinkId(value))
          }

          const nodeIds = [...nodes.values()]
            .map(({ id }) => id)
            .filter((id) => !retainedNodeIds.has(nodeKey(id)))
          for (const id of nodeIds) {
            nodes.delete(nodeKey(id))
            removeIncidentLinks(nodes, links, id)
          }
          const linkIds = [...links.keys()].filter(
            (id) => !retainedLinkIds.has(id)
          )
          for (const id of linkIds) removeSimulatedLink(nodes, links, id)
          prepared.push({ kind: mutation.kind, nodeIds, linkIds })
          break
        }
        case 'removeLinks': {
          const linkIds: LinkId[] = []
          for (const value of mutation.linkIds) {
            if (!Number.isInteger(value) || value < 0) {
              return 'removeLinks requires non-negative integer ids'
            }
            const id = toLinkId(value)
            const incumbent = linkStore.getTopology(scope.rootGraphId, id)
            if (incumbent && incumbent.graphId !== scope.owningGraphId) {
              return `link id ${id} belongs to graph ${incumbent.graphId}`
            }
            removeSimulatedLink(nodes, links, id)
            linkIds.push(id)
          }
          prepared.push({
            kind: mutation.kind,
            linkIds
          })
          break
        }
        case 'deleteNode': {
          const incumbent = nodeStore.getNode(
            scope.rootGraphId,
            mutation.nodeId
          )
          if (incumbent && incumbent.graphId !== scope.owningGraphId) {
            return `node id ${mutation.nodeId} belongs to graph ${incumbent.graphId}`
          }
          const removedLinkIds: LinkId[] = []
          for (const value of mutation.removedLinkIds) {
            if (!Number.isInteger(value) || value < 0) {
              return 'deleteNode requires non-negative integer link ids'
            }
            const id = toLinkId(value)
            const link = linkStore.getTopology(scope.rootGraphId, id)
            if (link && link.graphId !== scope.owningGraphId) {
              return `link id ${id} belongs to graph ${link.graphId}`
            }
            removedLinkIds.push(id)
          }
          nodes.delete(nodeKey(mutation.nodeId))
          removeIncidentLinks(nodes, links, mutation.nodeId)
          for (const id of removedLinkIds) {
            removeSimulatedLink(nodes, links, id)
          }
          prepared.push({
            kind: mutation.kind,
            nodeId: mutation.nodeId,
            removedLinkIds
          })
          break
        }
        case 'clearSemanticGraph': {
          const nodeIds = [...nodes.values()].map(({ id }) => id)
          nodes.clear()
          links.clear()
          prepared.push({ kind: mutation.kind, nodeIds })
          break
        }
      }
    }
    return prepared
  }

  function offsetInsertedBatch(
    scope: GraphScope,
    existingIds: readonly NodeId[],
    prepared: readonly PreparedMutation[]
  ): void {
    const inserted = prepared.filter(
      (mutation): mutation is Extract<PreparedMutation, { kind: 'addNode' }> =>
        mutation.kind === 'addNode' && mutation.queued === 'addNode'
    )
    if (inserted.length === 0) return
    const offset = placementOffset({
      existing: existingIds
        .map((id) => deps.placement.nodeBounds(scope, id))
        .filter((rect): rect is PlacementRect => rect !== null),
      viewport: deps.placement.viewportBounds(scope),
      incoming: inserted.map(({ node }) => ({
        x: node.layout.position.x,
        y: node.layout.position.y,
        width: node.layout.size.width,
        height: node.layout.size.height
      }))
    })
    if (!offset) return
    for (const { node } of inserted) {
      node.layout.position = {
        x: node.layout.position.x + offset.dx,
        y: node.layout.position.y + offset.dy
      }
      // The materializer configures the live node from lastSerialization, so
      // its pos must carry the same offset or configure() re-applies the raw
      // coordinates over the adopted layout entry.
      if (node.state.lastSerialization) {
        node.state.lastSerialization.pos = [
          node.layout.position.x,
          node.layout.position.y
        ]
      }
    }
  }

  function detachLinkSlots(
    scope: GraphScope,
    topology: LinkTopology,
    context: RemoteMutationContext
  ): void {
    const nodes = nodeStore.getGraphNodesFor(
      scope.rootGraphId,
      scope.owningGraphId
    )
    for (const [nodeId, slots] of detachedLinkSlots(nodes, topology)) {
      nodeStore.updateNodeSlots(scope, nodeId, slots, context)
    }
  }

  function removeLink(
    scope: GraphScope,
    topology: LinkTopology,
    context: RemoteMutationContext
  ): void {
    detachLinkSlots(scope, topology, context)
    if (linkStore.deleteLink(scope, topology, context)) {
      linkPresentationStore.take(scope, topology.id)
    }
  }

  function deleteNode(
    scope: GraphScope,
    nodeId: NodeId,
    removedLinkIds: readonly LinkId[],
    context: RemoteMutationContext
  ): void {
    const node = nodeStore
      .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
      .find((candidate) => candidate.id === nodeId)
    const incident = [...linkStore.graphTopologies(scope)].filter(
      (topology) =>
        topology.originNodeId === nodeId ||
        topology.targetNodeId === nodeId ||
        removedLinkIds.includes(topology.id)
    )
    for (const topology of incident) {
      removeLink(scope, topology, context)
    }
    widgetStore.clearNode(scope.rootGraphId, nodeId, context)
    if (node) nodeStore.deleteNode(scope, node, context)
    deps.layout.deleteNodes(scope, [nodeId], context)
  }

  /**
   * Replays the value through the live widget first so its callback and
   * backing property run in the same frame the semantic state is written, and
   * reports the value the live widget settled on. A node or widget that is not
   * live is `skipped` and keeps the incoming value.
   */
  function projectLiveWidgetValue(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue,
    context: RemoteMutationContext
  ): WidgetValue {
    const projected = deps.liveWidgets?.setValue(
      scope,
      nodeId,
      name,
      value,
      context
    )
    return projected && projected.status !== 'skipped'
      ? projected.resolvedValue
      : value
  }

  function registerPlaceholder(
    scope: GraphScope,
    nodeId: NodeId,
    widget: PlaceholderWidget,
    context: RemoteMutationContext
  ): void {
    const value = projectLiveWidgetValue(
      scope,
      nodeId,
      widget.name,
      widget.value,
      context
    )
    widgetStore.registerWidget(
      widgetId(scope.rootGraphId, nodeId, widget.name),
      {
        name: widget.name,
        type: widget.type,
        value,
        options: {},
        label: widget.name
      },
      {},
      undefined,
      context
    )
    // The registered state is a new identity, so a live widget that was
    // already mounted has to adopt it instead of keeping its own shim.
    deps.liveWidgets?.rebind?.(scope, nodeId, widget.name)
  }

  function setWidgetValue(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue,
    context: RemoteMutationContext
  ): void {
    const id = widgetId(scope.rootGraphId, nodeId, name)
    if (widgetStore.getWidget(id)) {
      widgetStore.setValue(
        id,
        projectLiveWidgetValue(scope, nodeId, name, value, context),
        context
      )
    } else {
      registerPlaceholder(
        scope,
        nodeId,
        { name, value, type: widgetType(value) },
        context
      )
    }
  }

  /**
   * A doc entry for a node that is already live is a value patch: the live
   * widgets keep their registered type, options, and state identity, and a
   * value the payload omits keeps its current value. Positional values bind
   * to the serialized widgets in order, the same order `LGraphNode.serialize`
   * wrote them in.
   */
  function applyWidgetValues(
    scope: GraphScope,
    nodeId: NodeId,
    widgets: WidgetValuePayload,
    context: RemoteMutationContext
  ): void {
    switch (widgets.kind) {
      case 'omitted':
        return
      case 'named':
        for (const [name, value] of widgets.values) {
          setWidgetValue(scope, nodeId, name, value, context)
        }
        return
      case 'positional': {
        const serialized = widgetStore
          .getNodeWidgets(scope.rootGraphId, nodeId)
          .filter((widget) => widget.serialize !== false)
          .slice(0, widgets.values.length)
        for (const [index, widget] of serialized.entries()) {
          setWidgetValue(
            scope,
            nodeId,
            widget.name,
            widgets.values[index],
            context
          )
        }
        return
      }
      default: {
        const unhandled: never = widgets
        return unhandled
      }
    }
  }

  function commit(
    scope: GraphScope,
    prepared: readonly PreparedMutation[],
    context: RemoteMutationContext
  ): void {
    for (const mutation of prepared) {
      switch (mutation.kind) {
        case 'addNode':
        case 'reconcileNode':
        case 'replaceNode': {
          let existing = nodeStore.getNode(
            scope.rootGraphId,
            mutation.node.state.id
          )
          if (mutation.kind === 'replaceNode' && existing) {
            deleteNode(scope, existing.id, [], context)
            forgetAutogrowGroups(existing.id)
            existing = undefined
          }
          if (mutation.kind === 'reconcileNode' && existing) {
            nodeStore.updateNode(
              scope,
              mutation.node.state.id,
              mutation.node.state,
              context
            )
            applyWidgetValues(
              scope,
              mutation.node.state.id,
              mutation.node.widgets,
              context
            )
            break
          }
          nodeStore.registerNode(scope, mutation.node.state, context)
          for (const widget of placeholderWidgets(mutation.node.widgets)) {
            registerPlaceholder(scope, mutation.node.state.id, widget, context)
          }
          deps.layout.createNode(
            scope,
            mutation.node.state.id,
            mutation.node.layout,
            context
          )
          break
        }
        case 'reconcileNodeFields': {
          nodeStore.updateNodeFields(
            scope,
            mutation.state.id,
            mutation.state,
            context
          )
          applyWidgetValues(scope, mutation.state.id, mutation.widgets, context)
          break
        }
        case 'setWidget': {
          setWidgetValue(
            scope,
            mutation.nodeId,
            mutation.name,
            mutation.value,
            context
          )
          break
        }
        case 'connect': {
          const existing = linkStore.getTopology(
            scope.rootGraphId,
            mutation.topology.id
          )
          const presentation = existing
            ? linkPresentationStore.getPresentation(scope, existing.id)
            : undefined
          if (existing) removeLink(scope, existing, context)
          const occupant = linkStore.getInputSlotLink(
            scope,
            mutation.topology.targetNodeId,
            mutation.topology.targetSlot
          )
          const replacement = linkStore.replaceLink(
            scope,
            occupant,
            mutation.topology,
            context
          )
          if (!replacement) break
          if (occupant) {
            detachLinkSlots(scope, occupant, context)
            linkPresentationStore.take(scope, occupant.id)
          }
          if (presentation) {
            linkPresentationStore.patch(scope, replacement.id, presentation)
          }

          const endpointNodes = new Map(
            nodeStore
              .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
              .map((node) => [nodeKey(node.id), node])
          )
          const origin = endpointNodes.get(
            nodeKey(mutation.topology.originNodeId)
          )
          const target = endpointNodes.get(
            nodeKey(mutation.topology.targetNodeId)
          )
          if (origin && mutation.originOutputs) {
            nodeStore.updateNodeSlots(
              scope,
              origin.id,
              {
                inputs: origin.inputs,
                outputs: patchLiveOutputSlots(
                  origin.outputs,
                  mutation.originOutputs
                )
              },
              context
            )
          }
          if (target && mutation.targetInputs) {
            nodeStore.updateNodeSlots(
              scope,
              target.id,
              {
                inputs: patchLiveInputSlots(
                  target.inputs,
                  mutation.targetInputs
                ),
                outputs: target.outputs
              },
              context
            )
          }
          break
        }
        case 'removeMissing':
          for (const id of mutation.linkIds) {
            const topology = linkStore.getTopology(scope.rootGraphId, id)
            if (topology) removeLink(scope, topology, context)
          }
          for (const id of mutation.nodeIds) {
            deleteNode(scope, id, [], context)
            forgetAutogrowGroups(id)
          }
          break
        case 'removeLinks':
          for (const id of mutation.linkIds) {
            const topology = linkStore.getTopology(scope.rootGraphId, id)
            if (topology) removeLink(scope, topology, context)
          }
          break
        case 'deleteNode':
          deleteNode(scope, mutation.nodeId, mutation.removedLinkIds, context)
          forgetAutogrowGroups(mutation.nodeId)
          break
        case 'clearSemanticGraph':
          for (const nodeId of mutation.nodeIds) {
            widgetStore.clearNode(scope.rootGraphId, nodeId, context)
            forgetAutogrowGroups(nodeId)
          }
          deps.layout.deleteNodes(scope, mutation.nodeIds, context)
          linkStore.clearOwner(scope, context)
          linkPresentationStore.clearOwner(scope)
          nodeStore.clearOwner(scope, context)
          break
      }
    }
  }

  const graphMutations: GraphMutations = {
    batch(context, define) {
      const scope = deps.getScope()
      if (!scope) return false
      const queued: QueuedMutation[] = []
      define({
        addNode(payload) {
          queued.push({ kind: 'addNode', payload })
        },
        reconcileNode(payload) {
          queued.push({ kind: 'reconcileNode', payload })
        },
        reconcileNodeFields(payload) {
          queued.push({ kind: 'reconcileNodeFields', payload })
        },
        setWidget(nodeId, name, value) {
          queued.push({ kind: 'setWidget', nodeId, name, value })
        },
        connect(link) {
          queued.push({ kind: 'connect', link })
        },
        removeMissing(retainedNodeIds, retainedLinkIds) {
          queued.push({
            kind: 'removeMissing',
            retainedNodeIds,
            retainedLinkIds
          })
        },
        removeLinks(linkIds) {
          queued.push({ kind: 'removeLinks', linkIds })
        },
        deleteNode(nodeId, removedLinkIds = []) {
          queued.push({ kind: 'deleteNode', nodeId, removedLinkIds })
        },
        clearSemanticGraph() {
          queued.push({ kind: 'clearSemanticGraph' })
        }
      })
      const existingIds = nodeStore
        .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
        .map((node) => node.id)
      const prepared = prepare(scope, queued)
      if (typeof prepared === 'string') return fail(prepared)
      offsetInsertedBatch(scope, existingIds, prepared)
      commit(scope, prepared, context)
      return true
    },
    addNode(payload, context) {
      return graphMutations.batch(context, (batch) => batch.addNode(payload))
    },
    setWidget(nodeId, name, value, context) {
      return graphMutations.batch(context, (batch) =>
        batch.setWidget(nodeId, name, value)
      )
    },
    connect(link, context) {
      return graphMutations.batch(context, (batch) => batch.connect(link))
    },
    deleteNode(nodeId, removedLinkIds, context) {
      return graphMutations.batch(context, (batch) =>
        batch.deleteNode(nodeId, removedLinkIds)
      )
    },
    clearSemanticGraph(context) {
      return graphMutations.batch(context, (batch) =>
        batch.clearSemanticGraph()
      )
    }
  }

  return graphMutations
}
