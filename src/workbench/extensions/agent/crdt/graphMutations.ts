import { isPlainObject } from 'es-toolkit'
import { isEqual } from 'es-toolkit/compat'

import { isAutogrowGroupMember } from '@/core/graph/widgets/dynamicWidgets'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot
} from '@/lib/litegraph/src/interfaces'
import type {
  ISerialisableNodeInput,
  ISerialisableNodeOutput,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
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
 * `createGraphMutations`) falls back first to its own remembered answer from
 * an earlier `member`/`notMember` for the same node and name, then to
 * `nodeDefAutogrowGroupOf`'s read of the node TYPE's own static definition,
 * and only to `nameShapeAutogrowGroupOf`'s inference when neither has ever
 * resolved that name definitively.
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

export type GraphMutationBatchResult =
  | { readonly kind: 'committed' }
  | { readonly kind: 'rejected'; readonly reason: 'no-scope' | 'validation' }

export interface GraphMutations {
  batch(
    context: RemoteMutationContext,
    define: (batch: GraphMutationBatch) => void
  ): boolean
  batchResult(
    context: RemoteMutationContext,
    define: (batch: GraphMutationBatch) => void
  ): GraphMutationBatchResult
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
  | {
      kind: 'reconcileNode'
      node: PreparedNode
      documentInputs: unknown
      preserveLinkedAutogrow: boolean
    }
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

const SERIALISABLE_SLOT_FIELDS = [
  'name',
  'localized_name',
  'label',
  'type',
  'dir',
  'removable',
  'shape',
  'color_off',
  'color_on',
  'locked',
  'nameLocked',
  'pos'
] as const satisfies readonly (keyof INodeSlot)[]

function serialisableSlotFields(
  raw: Record<string, unknown>,
  additional: readonly string[]
): Record<string, unknown> {
  return Object.fromEntries(
    [...SERIALISABLE_SLOT_FIELDS, ...additional].flatMap((field) =>
      Object.hasOwn(raw, field) ? [[field, structuredClone(raw[field])]] : []
    )
  )
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
  slot: INodeInputSlot,
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
  slot: INodeInputSlot,
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
): INodeInputSlot | undefined {
  if (
    typeof raw.name !== 'string' ||
    (typeof raw.type !== 'string' && typeof raw.type !== 'number')
  ) {
    return undefined
  }
  const slot: INodeInputSlot = {
    name: raw.name,
    type: raw.type,
    boundingRect: [0, 0, 0, 0]
  }
  Object.assign(slot, serialisableSlotFields(raw, ['widget']))
  if (raw.link === null || typeof raw.link === 'number') {
    slot.link = raw.link === null ? null : toLinkId(raw.link)
  }
  applySlotLink(slot, index, existing)
  preserveSlotDisplayMetadata(slot, existing?.[index])
  return slot
}

function prepareInputSlots(
  value: unknown,
  existing?: readonly (NodeState['inputs'][number] | undefined)[]
): NodeState['inputs'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw, index) => {
    if (!isRecord(raw)) return []
    const slot = prepareInputSlot(raw, index, existing)
    return slot ? [slot] : []
  })
}

function prepareOutputSlots(value: unknown): NodeState['outputs'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (
      !isRecord(raw) ||
      typeof raw.name !== 'string' ||
      (typeof raw.type !== 'string' && typeof raw.type !== 'number')
    ) {
      return []
    }
    const slot: INodeOutputSlot = {
      name: raw.name,
      type: raw.type,
      boundingRect: [0, 0, 0, 0]
    }
    Object.assign(slot, serialisableSlotFields(raw, ['slot_index', 'widget']))
    if (raw.links === null) slot.links = null
    else if (Array.isArray(raw.links)) {
      slot.links = raw.links.map((id) => toLinkId(Number(id)))
    }
    return [slot]
  })
}

/**
 * A live node's input set can diverge from the document two ways: it grew
 * (autogrow appended a member, not yet named by the document) or it changed
 * for some other reason (a rename, a definition change, or autogrow itself
 * removing a member on disconnect/shrink). `mergeInputSlotsByName` only
 * merges by name on the growth path: every document input still exists
 * live, and any live-only leftover is either a widget-promoted input slot
 * (the wire format carries its value in `widgets_values`, never as a named
 * input, so no document snapshot can ever list or drop one) or an
 * autogrow-shaped spare that is either unlinked, or linked and the caller
 * opted into `preserveLinkedAutogrow`. `hasNonGrowthInputSetChange` (below)
 * detects the other path -- the document naming something live doesn't
 * have, or live keeping a leftover that is neither of those two exceptions
 * -- in which case the document is authoritative and the merge falls back
 * to positional preparation, letting stale live slots go.
 */
function hasNonGrowthInputSetChange(
  live: NodeState['inputs'],
  documentInputs: Record<string, unknown>[],
  autogrowGroupOf: (name: unknown) => string | undefined,
  preserveLinkedAutogrow: boolean
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
  // when it is a widget-promoted input slot, or both unlinked and
  // autogrow-shaped (see the contract above).
  const remainingByName = new Map(documentCounts)
  const liveOnlyIsUnaccountedFor = live.some((input) => {
    const remaining = remainingByName.get(input.name) ?? 0
    if (remaining > 0) {
      remainingByName.set(input.name, remaining - 1)
      return false
    }
    if (input.widget !== undefined) return false
    const autogrowGroup = autogrowGroupOf(input.name)
    if (autogrowGroup === undefined) return true
    return input.link !== null && !preserveLinkedAutogrow
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
  const inputSpec: unknown = nodeDef.inputs[groupName]
  const parsed = zAutogrowOptions.safeParse(inputSpec)
  const template = parsed.success ? parsed.data.template : undefined
  if (!template) return { known: true, group: undefined }
  const isMember = isAutogrowGroupMember(key, template.names)
  return { known: true, group: isMember ? groupName : undefined }
}

/**
 * The group prefix of a live-only input shaped like an autogrow member's
 * DEFAULT naming (`group.prefixN`, ending in the member's ordinal) --
 * undefined for anything else.
 *
 * LAST RESORT: used only once the live node (`SemanticLiveNodeQueryPort`),
 * this follower's own remembered `member`/`notMember` answer, and the node
 * type's own static definition (`nodeDefAutogrowGroupOf`) all have no
 * opinion -- e.g. the type hasn't loaded yet and this is the first time this
 * follower has ever resolved the name. A `NodeState` input itself carries no
 * autogrow marker, so absent every real answer this is inference from shape
 * alone, and shape is not a reliable signal in either direction:
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
  autogrowGroupOf: (name: unknown) => string | undefined,
  preserveLinkedAutogrow = false
): NodeState['inputs'] {
  const documentInputs = Array.isArray(supplied)
    ? supplied.filter(isRecord)
    : []
  const consumedLive = new Set<number>()
  const liveByName = documentInputs.map((slot) => {
    const index = live.findIndex(
      (input, i) => !consumedLive.has(i) && input.name === slot.name
    )
    if (index < 0) return undefined
    consumedLive.add(index)
    return live[index]
  })
  if (
    hasNonGrowthInputSetChange(
      live,
      documentInputs,
      autogrowGroupOf,
      preserveLinkedAutogrow
    )
  ) {
    return prepareInputSlots(documentInputs, live)
  }
  const merged = [...live]
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

function occurrenceIndexOf<T>(
  items: readonly T[],
  index: number,
  name: unknown,
  nameOf: (item: T) => unknown
): number {
  return items.slice(0, index).filter((item) => nameOf(item) === name).length
}

function resolveOccurrenceIndex<T>(
  items: readonly T[],
  name: unknown,
  occurrence: number,
  nameOf: (item: T) => unknown
): number {
  let seen = 0
  for (const [index, item] of items.entries()) {
    if (nameOf(item) !== name) continue
    if (seen === occurrence) return index
    seen++
  }
  return -1
}

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
  const occurrence = occurrenceIndexOf(
    rawTargetInputs,
    rawTargetSlot,
    name,
    (candidate) => (isRecord(candidate) ? candidate.name : undefined)
  )
  const targetInputs = mergeInputSlotsByName(
    liveInputs,
    rawTargetInputs,
    autogrowGroupOf
  )
  const resolvedSlot = resolveOccurrenceIndex(
    targetInputs,
    name,
    occurrence,
    (input) => input.name
  )
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

type ChangedNodeSlots = Map<NodeId, Pick<NodeState, 'inputs' | 'outputs'>>

function keepsOriginSlot(
  topology: LinkTopology,
  replacement: LinkTopology | undefined
): boolean {
  return (
    replacement?.id === topology.id &&
    replacement.originNodeId === topology.originNodeId &&
    replacement.originSlot === topology.originSlot
  )
}

function keepsTargetSlot(
  topology: LinkTopology,
  replacement: LinkTopology | undefined
): boolean {
  return (
    replacement?.id === topology.id &&
    replacement.targetNodeId === topology.targetNodeId &&
    replacement.targetSlot === topology.targetSlot
  )
}

function detachOriginSlot(
  nodesById: Map<string, NodeState>,
  topology: LinkTopology,
  replacement: LinkTopology | undefined,
  slotsFor: (node: NodeState) => Pick<NodeState, 'inputs' | 'outputs'>
): void {
  const origin = nodesById.get(nodeKey(topology.originNodeId))
  if (
    keepsOriginSlot(topology, replacement) ||
    !origin?.outputs[topology.originSlot]
  ) {
    return
  }
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

function detachTargetSlot(
  nodesById: Map<string, NodeState>,
  topology: LinkTopology,
  replacement: LinkTopology | undefined,
  slotsFor: (node: NodeState) => Pick<NodeState, 'inputs' | 'outputs'>
): void {
  const target = nodesById.get(nodeKey(topology.targetNodeId))
  if (
    keepsTargetSlot(topology, replacement) ||
    target?.inputs[topology.targetSlot]?.link !== topology.id
  ) {
    return
  }
  const slots = slotsFor(target)
  slots.inputs = slots.inputs.map((input, index) =>
    index === topology.targetSlot && isPlainObject(input)
      ? { ...input, link: null }
      : input
  )
}

function detachedLinkSlots(
  nodes: Iterable<NodeState>,
  topology: LinkTopology,
  replacement?: LinkTopology
): ChangedNodeSlots {
  const nodesById = new Map([...nodes].map((node) => [nodeKey(node.id), node]))
  const changed: ChangedNodeSlots = new Map()
  const slotsFor = (node: NodeState) => {
    const prior = changed.get(node.id)
    if (prior) return prior
    const slots = { inputs: node.inputs, outputs: node.outputs }
    changed.set(node.id, slots)
    return slots
  }

  detachOriginSlot(nodesById, topology, replacement, slotsFor)
  detachTargetSlot(nodesById, topology, replacement, slotsFor)

  return changed
}

function removeIncidentLinks(
  nodes: Map<string, NodeState>,
  links: Map<LinkId, LinkTopology>,
  nodeId: NodeId
): void {
  for (const [id, topology] of Array.from(links)) {
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
 * A remembered live `member`/`notMember` answer, pinned to the exact node
 * INCARNATION it was answered for: the node type, and the identity of that
 * type's definition object at the time. Both are part of the entry because a
 * node id can be reused for a different type (replace), and a type name can
 * be re-registered against a different schema (hot reload) -- either way the
 * old answer describes a node that no longer exists and must not win.
 * `group: null` records a definitive "not a member"; no entry at all means
 * never resolved.
 */
interface RememberedAutogrowGroup {
  readonly nodeType: string
  readonly nodeDef: ComfyNodeDefImpl | undefined
  readonly group: string | null
}

/**
 * Distinguishes "never resolved" (the caller should fall through to the node
 * definition, then the name-shape heuristic) from a remembered, definitive
 * `notMember` (`group: undefined`, but resolved -- the caller must trust that
 * "no" and not let the heuristic override it).
 */
type RememberedAutogrowRead =
  | { readonly remembered: true; readonly group: string | undefined }
  | { readonly remembered: false }

type StagedAutogrowWrite =
  | {
      readonly kind: 'remember'
      readonly scope: GraphScope
      readonly nodeId: NodeId
      readonly name: string
      readonly entry: RememberedAutogrowGroup
    }
  | {
      readonly kind: 'forget'
      readonly scope: GraphScope
      readonly nodeId: NodeId
    }

/**
 * The writes one batch wants to make to the follower's autogrow memory. They
 * are staged rather than applied, because `prepare()` resolves (and therefore
 * learns) autogrow answers before a later queued mutation can still reject the
 * whole batch: a rejected batch must leave no trace, or a retry that finds the
 * live port `unavailable` classifies slots off an answer the store never
 * accepted.
 *
 * Each mutation's writes go into its own pending overlay (`remember`/`forget`
 * build it lazily off `read`'s current view -- this mutation's own overlay if
 * already touched, else the nearest earlier-indexed mutation's still-pending
 * overlay, else the batch's confirmed shadow, else the persisted store)
 * rather than straight onto the batch's shared shadow. A later mutation can
 * therefore see an earlier one's answer as soon as it is staged during
 * `prepare()`, before either has committed -- required for two mutations
 * prepared back to back in one batch to agree on the same name's
 * classification. `applyMutation` merges that overlay onto the shadow once
 * that mutation's own graph effect has actually landed; `rollbackMutation`
 * instead discards the overlay outright, so a mutation whose effect did not
 * land (e.g. `connect`'s `replaceLink` refusing a stale or collided target)
 * can never leak its staged answer to a later mutation in the same batch, no
 * matter how the two interleave on the same node. Each write is also
 * journaled the same way, so `applyMutation`
 * can additionally replay it onto the persisted store; a batch whose commit
 * throws partway through therefore keeps the memory writes for every
 * mutation that committed before the throw, and drops the rest, instead of
 * an all-or-nothing `apply()` that would discard already-committed
 * mutations' writes too.
 */
interface AutogrowMemoryDraft {
  read(
    scope: GraphScope,
    nodeId: NodeId,
    nodeType: string,
    name: string
  ): RememberedAutogrowRead
  remember(
    scope: GraphScope,
    nodeId: NodeId,
    nodeType: string,
    name: string,
    group: string | undefined
  ): void
  forget(scope: GraphScope, nodeId: NodeId): void
  beginMutation(mutationIndex: number): void
  applyMutation(mutationIndex: number): void
  rollbackMutation(mutationIndex: number): void
}

/**
 * This follower's own memory of live `member`/`notMember` autogrow answers, so
 * a later reconcile that finds the live node `unavailable` (unmounted,
 * background workflow) can prefer prior real provenance over guessing from the
 * name's shape again -- the same "carry it forward in the store we already
 * control" approach `preserveSlotDisplayMetadata` takes for
 * `localized_name`/`label`.
 *
 * One memory per `GraphMutations` instance, not per module, so distinct
 * followers never see each other's answers. A single instance is nonetheless
 * retained across graph scopes (production keeps one per cloud workflow while
 * resolving the current local workflow state on every batch), so the graph
 * scope is part of every key: the same node id, type and input name in another
 * root is a different node. The store nests a nested `Map` per scope field and
 * node id rather than joining them into one composite string key: those are
 * all plain strings whose constructors do not reject or escape an embedded
 * NUL, so a joined key can alias two different tuples, while a `Map` compares
 * each field by value with no such collision.
 */
function createAutogrowMemory() {
  const remembered = new Map<
    string,
    Map<string, Map<string, Map<string, RememberedAutogrowGroup>>>
  >()

  function currentNodeDef(nodeType: string): ComfyNodeDefImpl | undefined {
    return useNodeDefStore().getNodeDefByName(nodeType)
  }

  // A current, definitive node definition always beats stale memory: an entry
  // recorded against another type, or against a definition object that has
  // since been replaced by a re-registration, reads back as "never resolved"
  // so the caller consults the live definition instead.
  function readEntry(
    entry: RememberedAutogrowGroup | undefined,
    nodeType: string
  ): RememberedAutogrowRead {
    return entry &&
      entry.nodeType === nodeType &&
      entry.nodeDef === currentNodeDef(nodeType)
      ? { remembered: true, group: entry.group ?? undefined }
      : { remembered: false }
  }

  function nodeEntries(
    scope: GraphScope,
    nodeId: NodeId
  ): Map<string, RememberedAutogrowGroup> | undefined {
    return remembered
      .get(scope.rootGraphId)
      ?.get(scope.owningGraphId)
      ?.get(nodeKey(nodeId))
  }

  function ensureNodeEntries(
    scope: GraphScope,
    nodeId: NodeId
  ): Map<string, RememberedAutogrowGroup> {
    let forRoot = remembered.get(scope.rootGraphId)
    if (!forRoot) {
      forRoot = new Map()
      remembered.set(scope.rootGraphId, forRoot)
    }
    let forOwning = forRoot.get(scope.owningGraphId)
    if (!forOwning) {
      forOwning = new Map()
      forRoot.set(scope.owningGraphId, forOwning)
    }
    const key = nodeKey(nodeId)
    let forNode = forOwning.get(key)
    if (!forNode) {
      forNode = new Map()
      forOwning.set(key, forNode)
    }
    return forNode
  }

  function deleteNodeEntries(scope: GraphScope, nodeId: NodeId): void {
    remembered
      .get(scope.rootGraphId)
      ?.get(scope.owningGraphId)
      ?.delete(nodeKey(nodeId))
  }

  return {
    draft(): AutogrowMemoryDraft {
      const shadow = new Map<
        string,
        Map<string, RememberedAutogrowGroup> | null
      >()
      const pending = new Map<
        number,
        Map<string, Map<string, RememberedAutogrowGroup> | null>
      >()
      const journal = new Map<number, StagedAutogrowWrite[]>()
      let currentMutationIndex = -1

      function shadowKey(scope: GraphScope, nodeId: NodeId): string {
        return JSON.stringify([
          scope.rootGraphId,
          scope.owningGraphId,
          nodeKey(nodeId)
        ])
      }

      function stageWrite(write: StagedAutogrowWrite): void {
        let forMutation = journal.get(currentMutationIndex)
        if (!forMutation) {
          forMutation = []
          journal.set(currentMutationIndex, forMutation)
        }
        forMutation.push(write)
      }

      // `key`'s value as the current mutation's own writes see it: its own
      // pending overlay if already touched, else the most recent
      // still-pending overlay of an earlier-indexed mutation in this batch
      // (prepared before this one, but not yet committed or rolled back),
      // else the confirmed shadow (from mutations that have already
      // applied), else `undefined` to fall through to the persisted store.
      // The earlier-mutation scan only ever looks backward -- a mutation
      // never sees one prepared after it -- and a rolled-back mutation's
      // overlay is removed from `pending` entirely, so it is skipped here
      // exactly as if it had never written anything.
      function currentView(
        key: string
      ): Map<string, RememberedAutogrowGroup> | null | undefined {
        const ownPending = pending.get(currentMutationIndex)
        if (ownPending?.has(key)) return ownPending.get(key) ?? null
        for (let index = currentMutationIndex - 1; index >= 0; index--) {
          const forMutation = pending.get(index)
          if (forMutation?.has(key)) return forMutation.get(key) ?? null
        }
        if (shadow.has(key)) return shadow.get(key) ?? null
        return undefined
      }

      function setPending(
        key: string,
        value: Map<string, RememberedAutogrowGroup> | null
      ): void {
        let forMutation = pending.get(currentMutationIndex)
        if (!forMutation) {
          forMutation = new Map()
          pending.set(currentMutationIndex, forMutation)
        }
        forMutation.set(key, value)
      }

      function replayPending(write: StagedAutogrowWrite): void {
        const key = shadowKey(write.scope, write.nodeId)
        if (write.kind === 'forget') {
          setPending(key, null)
          return
        }
        const view = currentView(key)
        const forNode = new Map(
          view === undefined
            ? nodeEntries(write.scope, write.nodeId)
            : (view ?? undefined)
        )
        forNode.set(write.name, write.entry)
        setPending(key, forNode)
      }

      return {
        beginMutation(mutationIndex) {
          currentMutationIndex = mutationIndex
        },
        read(scope, nodeId, nodeType, name) {
          const key = shadowKey(scope, nodeId)
          const view = currentView(key)
          if (view !== undefined) return readEntry(view?.get(name), nodeType)
          return readEntry(nodeEntries(scope, nodeId)?.get(name), nodeType)
        },
        remember(scope, nodeId, nodeType, name, group) {
          const key = shadowKey(scope, nodeId)
          const view = currentView(key)
          const forNode = new Map(
            view === undefined
              ? nodeEntries(scope, nodeId)
              : (view ?? undefined)
          )
          const entry: RememberedAutogrowGroup = {
            nodeType,
            nodeDef: currentNodeDef(nodeType),
            group: group ?? null
          }
          forNode.set(name, entry)
          setPending(key, forNode)
          stageWrite({ kind: 'remember', scope, nodeId, name, entry })
        },
        forget(scope, nodeId) {
          setPending(shadowKey(scope, nodeId), null)
          stageWrite({ kind: 'forget', scope, nodeId })
        },
        applyMutation(mutationIndex) {
          const writes = journal.get(mutationIndex)
          if (writes) {
            journal.delete(mutationIndex)
            for (const write of writes) {
              switch (write.kind) {
                case 'remember':
                  ensureNodeEntries(write.scope, write.nodeId).set(
                    write.name,
                    write.entry
                  )
                  break
                case 'forget':
                  deleteNodeEntries(write.scope, write.nodeId)
                  break
                default: {
                  const unhandled: never = write
                  return unhandled
                }
              }
            }
          }
          const forMutation = pending.get(mutationIndex)
          if (!forMutation) return
          pending.delete(mutationIndex)
          for (const [key, value] of forMutation) shadow.set(key, value)
        },
        rollbackMutation(mutationIndex) {
          journal.delete(mutationIndex)
          pending.delete(mutationIndex)
          for (const index of Array.from(pending.keys())) {
            if (index > mutationIndex) pending.delete(index)
          }
          for (const [index, writes] of [...journal].sort(
            ([left], [right]) => left - right
          )) {
            if (index <= mutationIndex) continue
            currentMutationIndex = index
            for (const write of writes) replayPending(write)
          }
        }
      }
    }
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

  const autogrowMemory = createAutogrowMemory()

  // Prefers the live node's own autogrow group registration (real
  // provenance) over every fallback below, and stages that answer in
  // `memory` for later calls that can no longer ask the live node.
  //
  // The fallbacks run only when the live port itself has no opinion, i.e.
  // no port is wired at all, or the wired port answers `unavailable` (the
  // live node couldn't be asked, not that it was asked and said no) -- see
  // `SemanticLiveNodeQueryPort`/`LiveAutogrowGroupAnswer`. Memory comes
  // first among them, since it is real provenance the node already gave,
  // just not right now. Absent that -- including on this follower's very
  // first reconcile of the node -- `nodeDefAutogrowGroupOf` reads the same
  // registration off the node TYPE's own static definition, so it is
  // equally real provenance and does not depend on the node being live at
  // all. `nameShapeAutogrowGroupOf` is the true last resort, guessing from
  // the name's shape, for a name neither of those has ever resolved.
  function resolveAutogrowGroup(
    memory: AutogrowMemoryDraft,
    scope: GraphScope,
    nodeId: NodeId,
    nodeType: string,
    name: unknown
  ): string | undefined {
    if (typeof name !== 'string') return undefined
    const fallback = (): string | undefined => {
      const recalled = memory.read(scope, nodeId, nodeType, name)
      if (recalled.remembered) return recalled.group
      const fromDef = nodeDefAutogrowGroupOf(nodeType, name)
      return fromDef.known ? fromDef.group : nameShapeAutogrowGroupOf(name)
    }
    if (!deps.liveNodes) return fallback()
    const answer = deps.liveNodes.autogrowGroupOf(scope, nodeId, name)
    switch (answer.kind) {
      case 'member':
        memory.remember(scope, nodeId, nodeType, name, answer.group)
        return answer.group
      case 'notMember':
        memory.remember(scope, nodeId, nodeType, name, undefined)
        return undefined
      case 'unavailable':
        return fallback()
      default: {
        const unhandled: never = answer
        return unhandled
      }
    }
  }

  function fail(message: string): false {
    console.error(`[agent-crdt] graph mutation rejected: ${message}`)
    return false
  }

  function prepare(
    memory: AutogrowMemoryDraft,
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
    for (const [mutationIndex, mutation] of queued.entries()) {
      memory.beginMutation(mutationIndex)
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
            const preserveLinkedAutogrow = queued.some(
              (queuedMutation) =>
                queuedMutation.kind === 'connect' &&
                queuedMutation.link.targetNodeId === node.state.id
            )
            node.state.inputs = mergeInputSlotsByName(
              existing.inputs,
              mutation.payload.inputs,
              (name) =>
                resolveAutogrowGroup(
                  memory,
                  scope,
                  node.state.id,
                  node.state.type,
                  name
                ),
              preserveLinkedAutogrow
            )
            prepared.push({
              kind: 'reconcileNode',
              node,
              documentInputs: mutation.payload.inputs,
              preserveLinkedAutogrow
            })
            nodes.set(key, node.state)
            break
          }
          nodes.set(key, node.state)
          if (mutation.kind === 'addNode') {
            prepared.push({ kind: 'addNode', node, queued: 'addNode' })
          } else {
            const replaced = existing && existing.type !== node.state.type
            if (replaced) memory.forget(scope, node.state.id)
            if (replaced) prepared.push({ kind: 'replaceNode', node })
            else {
              prepared.push({
                kind: 'reconcileNode',
                node,
                documentInputs: mutation.payload.inputs,
                preserveLinkedAutogrow: false
              })
            }
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
              memory.forget(scope, node.state.id)
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
                  memory,
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
          if (
            topology.targetSlot < 0 ||
            topology.targetSlot >= targetInputs.length
          ) {
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
            memory.forget(scope, id)
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
          memory.forget(scope, mutation.nodeId)
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
          for (const id of nodeIds) memory.forget(scope, id)
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
    context: RemoteMutationContext,
    replacement?: LinkTopology
  ): void {
    const nodes = nodeStore.getGraphNodesFor(
      scope.rootGraphId,
      scope.owningGraphId
    )
    for (const [nodeId, slots] of detachedLinkSlots(
      nodes,
      topology,
      replacement
    )) {
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

  function deleteNodeState(
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
  }

  function deleteNode(
    scope: GraphScope,
    nodeId: NodeId,
    removedLinkIds: readonly LinkId[],
    context: RemoteMutationContext
  ): void {
    deleteNodeState(scope, nodeId, removedLinkIds, context)
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
   * A reconcile's doc snapshot predates a widget whose live value already
   * changed locally (a human edit, or any write that reached the widget
   * without going through this module's own commit) since it was last read
   * from the doc. Overwriting it here would replay stale text over what the
   * user is looking at (PM-1303/PM-1310 "hypothesis C"); an explicit
   * single-widget `setWidget` op is unaffected, since it calls
   * `setWidgetValue` directly rather than through this function.
   *
   * Protection lasts until the document actually reflects the local value,
   * not for a single skipped reconcile: the follower has no invariant that
   * only one stale full reconcile can happen before a genuinely newer value
   * lands (an unbound local edit that never minted, followed by a rejected
   * duplicate-add echo re-arming full reconciliation, can deliver the same
   * stale snapshot a second time). So this only lets a reconcile through
   * once its own candidate value already matches the widget's current one -
   * the document has caught up, and that write clears the mark itself, since
   * it carries a context. Anything else keeps skipping and keeps the mark.
   *
   * "Matches" has to be value equality, not reference equality:
   * `parseWidgetValues` (via `cloneWidgetValue`) runs a fresh
   * `structuredClone` over every object-typed candidate, so an
   * object-valued widget's doc-parsed value is never the same object
   * instance as the widget's stored value even once the document
   * genuinely reflects it. `Object.is`/`===` would then never see the two
   * as equal, so the guard could never conclude the document caught up and
   * the dirty mark would never clear except via an explicit `setWidget`.
   */
  function skipStaleReconcile(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue
  ): boolean {
    const id = widgetId(scope.rootGraphId, nodeId, name)
    if (!isWidgetId(id) || !widgetStore.isLocallyDirty(id)) return false
    return !isEqual(widgetStore.getWidget(id)?.value, value)
  }

  /**
   * The `named` half of `applyWidgetValues`: values keyed by widget name,
   * applied in whatever order the doc map iterates.
   */
  function applyNamedWidgetValues(
    scope: GraphScope,
    nodeId: NodeId,
    values: ReadonlyMap<string, WidgetValue>,
    context: RemoteMutationContext,
    guardLocalEdits: boolean
  ): void {
    for (const [name, value] of values) {
      if (guardLocalEdits && skipStaleReconcile(scope, nodeId, name, value)) {
        continue
      }
      setWidgetValue(scope, nodeId, name, value, context)
    }
  }

  /**
   * The `positional` half of `applyWidgetValues`: values bind to the live
   * node's serialized widgets in order, the same order `LGraphNode.serialize`
   * wrote them in.
   */
  function applyPositionalWidgetValues(
    scope: GraphScope,
    nodeId: NodeId,
    values: readonly WidgetValue[],
    context: RemoteMutationContext,
    guardLocalEdits: boolean
  ): void {
    const serialized = widgetStore
      .getNodeWidgets(scope.rootGraphId, nodeId)
      .filter((widget) => widget.serialize !== false)
      .slice(0, values.length)
    for (const [index, widget] of serialized.entries()) {
      if (
        guardLocalEdits &&
        skipStaleReconcile(scope, nodeId, widget.name, values[index])
      ) {
        continue
      }
      setWidgetValue(scope, nodeId, widget.name, values[index], context)
    }
  }

  /**
   * A doc entry for a node that is already live is a value patch: the live
   * widgets keep their registered type, options, and state identity, and a
   * value the payload omits keeps its current value.
   *
   * `guardLocalEdits` skips a widget via {@link skipStaleReconcile}; it is only set
   * for a plain node's `reconcileNode`. A subgraph host's `reconcileNodeFields`
   * leaves it off: a host's promoted widgets are wired by `SubgraphNode`'s own
   * projection (`promotedWidgetStoreProjection.ts`), which writes them
   * directly (no `RemoteMutationContext`) as a routine, structural part of
   * (re)attaching the host - not a human edit - so the same signal that
   * catches a stale reconcile on a plain widget would misfire here.
   */
  function applyWidgetValues(
    scope: GraphScope,
    nodeId: NodeId,
    widgets: WidgetValuePayload,
    context: RemoteMutationContext,
    guardLocalEdits: boolean
  ): void {
    switch (widgets.kind) {
      case 'omitted':
        return
      case 'named':
        applyNamedWidgetValues(
          scope,
          nodeId,
          widgets.values,
          context,
          guardLocalEdits
        )
        return
      case 'positional':
        applyPositionalWidgetValues(
          scope,
          nodeId,
          widgets.values,
          context,
          guardLocalEdits
        )
        return
      default: {
        const unhandled: never = widgets
        return unhandled
      }
    }
  }

  /**
   * `addNode`/`reconcileNode`/`replaceNode` share one upsert: a `replaceNode`
   * onto an existing node deletes it first: a `reconcileNode` onto an
   * existing node patches fields and widgets in place (through
   * `applyWidgetValues`'s local-edit guard); anything else registers the
   * node fresh, from placeholder widgets.
   */
  function commitUpsertNode(
    scope: GraphScope,
    mutation: Extract<
      PreparedMutation,
      { kind: 'addNode' | 'reconcileNode' | 'replaceNode' }
    >,
    context: RemoteMutationContext,
    memory: AutogrowMemoryDraft,
    revalidateInputs: boolean
  ): void {
    const existing = nodeStore.getNode(
      scope.rootGraphId,
      mutation.node.state.id
    )
    if (mutation.kind === 'reconcileNode' && existing) {
      const state = revalidateInputs
        ? {
            ...mutation.node.state,
            inputs: mergeInputSlotsByName(
              existing.inputs,
              mutation.documentInputs,
              (name) =>
                resolveAutogrowGroup(
                  memory,
                  scope,
                  mutation.node.state.id,
                  mutation.node.state.type,
                  name
                ),
              mutation.preserveLinkedAutogrow
            )
          }
        : mutation.node.state
      nodeStore.updateNode(scope, state.id, state, context)
      applyWidgetValues(
        scope,
        mutation.node.state.id,
        mutation.node.widgets,
        context,
        true
      )
      return
    }
    // `layout.createNode` is a fallible renderer-owned effect; it must run
    // before the incumbent (a type-changing `replaceNode`'s prior node, if
    // any) is torn down or the new node becomes visible in the store, so a
    // throw here leaves the incumbent's full state -- and this mutation's
    // memory journal -- untouched instead of losing it mid-replacement or
    // registering a node the layout never got.
    deps.layout.createNode(
      scope,
      mutation.node.state.id,
      mutation.node.layout,
      context
    )
    if (mutation.kind === 'replaceNode' && existing) {
      deleteNodeState(scope, existing.id, [], context)
    }
    nodeStore.registerNode(scope, mutation.node.state, context)
    for (const widget of placeholderWidgets(mutation.node.widgets)) {
      registerPlaceholder(scope, mutation.node.state.id, widget, context)
    }
  }

  function commit(
    scope: GraphScope,
    prepared: readonly PreparedMutation[],
    context: RemoteMutationContext,
    memory: AutogrowMemoryDraft
  ): void {
    let revalidatePreparedInputs = false
    for (const [index, mutation] of prepared.entries()) {
      memory.beginMutation(index)
      let committed = true
      switch (mutation.kind) {
        case 'addNode':
        case 'reconcileNode':
        case 'replaceNode': {
          commitUpsertNode(
            scope,
            mutation,
            context,
            memory,
            revalidatePreparedInputs
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
          applyWidgetValues(
            scope,
            mutation.state.id,
            mutation.widgets,
            context,
            false
          )
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
          let targetInputs = mutation.targetInputs
          if (target && targetInputs) {
            const targetName = targetInputs[mutation.topology.targetSlot].name
            const targetOccurrence = occurrenceIndexOf(
              targetInputs,
              mutation.topology.targetSlot,
              targetName,
              (input) => input.name
            )
            targetInputs = mergeInputSlotsByName(
              target.inputs,
              targetInputs,
              (name) =>
                resolveAutogrowGroup(
                  memory,
                  scope,
                  target.id,
                  target.type,
                  name
                ),
              true
            )
            mutation.topology.targetSlot = resolveOccurrenceIndex(
              targetInputs,
              targetName,
              targetOccurrence,
              (input) => input.name
            )
          }
          const existing = linkStore.getTopology(
            scope.rootGraphId,
            mutation.topology.id
          )
          const presentation = existing
            ? linkPresentationStore.getPresentation(scope, existing.id)
            : undefined
          const occupant = linkStore.getInputSlotLink(
            scope,
            mutation.topology.targetNodeId,
            mutation.topology.targetSlot
          )
          const replacement = linkStore.replaceLink(
            scope,
            occupant,
            mutation.topology,
            existing,
            context
          )
          if (!replacement) {
            committed = false
            break
          }
          for (const displaced of new Set(
            [existing, occupant].filter(
              (topology): topology is LinkTopology => topology !== undefined
            )
          )) {
            detachLinkSlots(scope, displaced, context, replacement)
            linkPresentationStore.take(scope, displaced.id)
          }
          if (presentation) {
            linkPresentationStore.patch(scope, replacement.id, presentation)
          }

          if (origin && mutation.originOutputs) {
            nodeStore.replaceNodeSlots(
              scope,
              origin.id,
              { inputs: origin.inputs, outputs: mutation.originOutputs },
              context
            )
          }
          if (target && targetInputs) {
            nodeStore.replaceNodeSlots(
              scope,
              target.id,
              { inputs: targetInputs, outputs: target.outputs },
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
          break
        case 'clearSemanticGraph':
          for (const nodeId of mutation.nodeIds) {
            widgetStore.clearNode(scope.rootGraphId, nodeId, context)
          }
          deps.layout.deleteNodes(scope, mutation.nodeIds, context)
          linkStore.clearOwner(scope, context)
          linkPresentationStore.clearOwner(scope)
          nodeStore.clearOwner(scope, context)
          break
      }
      if (committed) memory.applyMutation(index)
      else {
        memory.rollbackMutation(index)
        revalidatePreparedInputs = true
      }
    }
  }

  const runBatch = (
    context: RemoteMutationContext,
    define: (batch: GraphMutationBatch) => void
  ): GraphMutationBatchResult => {
    const scope = deps.getScope()
    if (!scope) return { kind: 'rejected', reason: 'no-scope' }
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
    const memory = autogrowMemory.draft()
    const prepared = prepare(memory, scope, queued)
    if (typeof prepared === 'string') {
      fail(prepared)
      return { kind: 'rejected', reason: 'validation' }
    }
    offsetInsertedBatch(scope, existingIds, prepared)
    commit(scope, prepared, context, memory)
    return { kind: 'committed' }
  }

  const graphMutations: GraphMutations = {
    batch(context, define) {
      return runBatch(context, define).kind === 'committed'
    },
    batchResult: runBatch,
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
