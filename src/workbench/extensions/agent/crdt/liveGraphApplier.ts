import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY,
  readStamps
} from '@comfyorg/comfy-multi-player'
import { isEqual } from 'es-toolkit'
import * as Y from 'yjs'
import { z } from 'zod'

import { growAutogrowInput } from '@/core/graph/widgets/dynamicWidgets'
import type { INodeFlags, INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { withGraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import { detachSerialisedLinks } from '@/lib/litegraph/src/linkDeduplication'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { topologicalSortSubgraphs } from '@/lib/litegraph/src/subgraph/subgraphDeduplication'
import type {
  ExportedSubgraph,
  ISerialisableNodeInput,
  ISerialisableNodeOutput,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { zComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'
import { isUuidShapedSubgraphId } from '@/schemas/subgraphIdSchema'
import type { LinkId } from '@/types/linkId'
import { parseLinkId, toLinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'

import {
  allSubgraphDefinitions,
  projectCrdtValue,
  readDefinitionPromotedLayout,
  readDocPromotedWidgets,
  readDocPromotedWidgetValue,
  readSubgraphDefinitions
} from './agentSubgraphDefinitions'
import type { definitionPromotedLayout } from './agentSubgraphDefinitions'
import type { PlacementRect } from './batchPlacement'
import { placementOffset } from './batchPlacement'

export type NodeChange = 'add' | 'update' | 'delete'

/**
 * What one delivered document frame touched, as collected from Y observers.
 * Ids are document keys (strings); the applier resolves them against the live
 * graph.
 */
export interface FrameChanges {
  nodes: ReadonlyMap<string, NodeChange>
  /** Widget names edited per node, or `'all'` when the storage was replaced. */
  widgets: ReadonlyMap<string, ReadonlySet<string> | 'all'>
  resyncNodes: ReadonlySet<string>
  links: ReadonlySet<string>
}

export interface RemoteApplyContext {
  actor: string
  opIds: readonly string[]
}

export interface LiveGraphApplierDeps {
  getGraph(): LGraph | null
  getCanvas?(): LGraphCanvas | null | undefined
  /** Scopes layout provenance to the remote actor while `fn` writes. */
  withRemoteActor?<T>(actor: string, fn: () => T): T
  viewportBounds?(): PlacementRect | null
  /**
   * True when a local write to the widget register is still in flight and
   * `docValue` is not it; the frame's value is then left unapplied so the
   * register is not rewound under the edit.
   */
  holdsLocalWrite?(nodeId: string, widget: string, docValue: unknown): boolean
}

export interface ApplyResult {
  createdNodeIds: NodeId[]
}

/**
 * `merge` applies one frame's changes on top of the live graph. `replace`
 * applies the first frame of a new document lineage: the document is the
 * whole graph, so live nodes and links it does not hold are removed.
 */
export type ApplyMode = 'merge' | 'replace'

/**
 * Node-map keys mirrored onto a live node when the document edits them.
 * Structural keys (`inputs`, `outputs`, `pos`, `size`, widget storage) are
 * excluded: slots follow links, layout stays local.
 */
export const SYNCED_NODE_FIELDS: ReadonlySet<string> = new Set([
  'title',
  'mode',
  'flags',
  'properties',
  'color',
  'bgcolor',
  'boxcolor',
  'shape',
  'showAdvanced'
])

const SYNCED_APPEARANCE_FIELDS = [
  'color',
  'bgcolor',
  'boxcolor',
  'shape',
  'showAdvanced'
] as const

const AGENT_APPLY_TAGS = { subsystem: 'agent-crdt', layer: 'graph-api' }

interface DocNode {
  id: string
  type: string
  serialised: ISerialisedNode
  widgets: Record<string, unknown> | unknown[] | undefined
  widgetIssue?: string
}

interface DocLink {
  id: LinkId
  origin: string
  originSlot: number
  target: string
  targetSlot: number
}

function plain(value: unknown): unknown {
  return projectCrdtValue(value)
}

/**
 * `flags.ghost` marks a node the user is still placing; the snapshot minted
 * while placement is live carries it, but the flag is local interaction
 * state, never document state.
 */
function syncedFlags(flags: INodeFlags | undefined): INodeFlags {
  const { ghost: _ghost, ...rest } = flags ?? {}
  return rest
}

const zDocSlot = z
  .object({ name: z.string(), type: z.union([z.string(), z.number()]) })
  .passthrough()
const zNodeProperty = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.object({}).passthrough(),
  z.array(z.unknown()),
  z.null()
])

/**
 * The shape a document node must have before it can configure a live node.
 * Agent-minted nodes are sparse, so geometry and mode fall back to defaults;
 * slot and property shapes are enforced because `LGraphNode.configure` maps
 * over them without checking. Slot link references are not validated because
 * `detachSerialisedLinks` discards them; links come from the links map.
 * Widget values live in the node's `widgets` map, never in `widgets_values`.
 */
const zDocNodeFields = zComfyNode
  .partial({ pos: true, size: true, flags: true, order: true, mode: true })
  .omit({ widgets_values: true })
  .extend({
    id: z.string(),
    type: z.string().min(1),
    title: z.string().optional(),
    inputs: z.array(zDocSlot).optional(),
    outputs: z.array(zDocSlot).optional(),
    properties: z.record(zNodeProperty.optional()).optional()
  })

/**
 * Only the actor's kind is reported: the segments after it in
 * `agent:<thread>:<turn>` and `human:<user>:<tab>` identify a user.
 */
type ActorKind = 'agent' | 'human' | 'unknown'
type NodeProducer =
  | { origin: 'operation'; actorKind: ActorKind; opId: string; version: number }
  | { origin: 'unstamped' | 'unreadable' }

interface MalformedDocNode {
  malformed: string
  discriminate(): {
    classType?: string
    valueShapes: string
    producer: NodeProducer
  }
}

function valueShape(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `array:${value.length}`
  if (typeof value === 'object') return `object:${Object.keys(value).length}`
  return typeof value
}

/** `absent` when the path's own key is missing, so it is not read as `undefined`. */
function shapeAtPath(
  root: unknown,
  path: readonly (string | number)[]
): string {
  let cursor: unknown = root
  for (const [depth, key] of path.entries()) {
    if (cursor === null || typeof cursor !== 'object') return 'unreachable'
    if (!Object.hasOwn(cursor, key))
      return depth === path.length - 1 ? 'absent' : 'unreachable'
    cursor = Reflect.get(cursor, key)
  }
  return valueShape(cursor)
}

function issueShapes(fields: unknown, error: z.ZodError): string {
  return error.issues
    .map(
      (issue) =>
        `${issue.path.join('.')} ${issue.code} ${shapeAtPath(fields, issue.path)}`
    )
    .join('; ')
}

function actorKind(actor: unknown): ActorKind {
  const kind = typeof actor === 'string' ? actor.split(':', 1)[0] : ''
  return kind === 'agent' || kind === 'human' ? kind : 'unknown'
}

function nodeProducer(doc: Y.Doc, id: string): NodeProducer {
  let stamps: Readonly<Record<string, unknown>>
  try {
    stamps = readStamps(doc)
  } catch {
    return { origin: 'unreadable' }
  }
  const key = JSON.stringify(['node', id])
  if (!Object.hasOwn(stamps, key)) return { origin: 'unstamped' }
  const stamp = stamps[key]
  if (!Array.isArray(stamp)) return { origin: 'unreadable' }
  const [version, actor, opId]: unknown[] = stamp
  if (typeof version !== 'number' || typeof opId !== 'string')
    return { origin: 'unreadable' }
  return {
    origin: 'operation',
    actorKind: actorKind(actor),
    opId,
    version
  }
}

function readDocNodeWidgets(
  source: Y.Map<unknown>,
  widgetIssue: string | undefined
): DocNode['widgets'] {
  if (widgetIssue) return undefined
  const named = source.get('widgets')
  if (named instanceof Y.Map) {
    const projected = plain(named)
    return typeof projected === 'object' && projected !== null
      ? (projected as Record<string, unknown>)
      : undefined
  }
  const opaque = plain(source.get(OPAQUE_WIDGETS_KEY))
  return Array.isArray(opaque) ? opaque : undefined
}

function isDocNodeStorageKey(key: string): boolean {
  return (
    key === 'id' ||
    key === 'widgets' ||
    key === OPAQUE_WIDGETS_KEY ||
    key === 'widgets_values' ||
    key === 'widgets_values_named'
  )
}

function readDocNodeFields(
  source: Y.Map<unknown>,
  id: string
): Record<string, unknown> {
  const fields: Record<string, unknown> = Object.assign(
    Object.create(null) as Record<string, unknown>,
    { id }
  )
  for (const [key, value] of source.entries()) {
    if (key !== '__proto__' && !isDocNodeStorageKey(key))
      fields[key] = plain(value)
  }
  return fields
}

function readDocNode(
  doc: Y.Doc,
  id: string
): DocNode | MalformedDocNode | null {
  const source = nodesMap(doc).get(id)
  if (!(source instanceof Y.Map)) return null
  const widgetIssue =
    source.has('widgets') && source.has(OPAQUE_WIDGETS_KEY)
      ? `node carries both widgets and ${OPAQUE_WIDGETS_KEY}`
      : undefined
  let fields: Record<string, unknown>
  let widgets: DocNode['widgets']
  try {
    fields = readDocNodeFields(source, id)
    widgets = readDocNodeWidgets(source, widgetIssue)
  } catch {
    const rawType = source.get('type')
    return {
      malformed: 'node fields could not be projected safely',
      discriminate() {
        return {
          classType: typeof rawType === 'string' ? rawType : undefined,
          valueShapes: 'projection unreadable',
          producer: nodeProducer(doc, id)
        }
      }
    }
  }
  const parsed = zDocNodeFields.safeParse(fields)
  if (!parsed.success) {
    const { error } = parsed
    return {
      malformed: error.issues
        .map((issue) => `${issue.path.join('.')} ${issue.message}`)
        .join('; '),
      discriminate() {
        return {
          classType: typeof fields.type === 'string' ? fields.type : undefined,
          valueShapes: issueShapes(fields, error),
          producer: nodeProducer(doc, id)
        }
      }
    }
  }
  const {
    pos = [0, 0],
    size = [0, 0],
    flags,
    order = 0,
    mode = 0,
    ...rest
  } = parsed.data
  const serialised: ISerialisedNode = {
    ...rest,
    pos,
    size,
    flags: syncedFlags(flags),
    order,
    mode
  }
  return { id, type: serialised.type, serialised, widgets, widgetIssue }
}

function readDocLink(doc: Y.Doc, key: string): DocLink | null {
  const raw = linksMap(doc).get(key)
  const tuple = raw instanceof Y.Array ? raw.toArray() : raw
  const id = parseLinkId(key)
  if (id === undefined || id < 0 || !isLinkTuple(tuple, id)) return null
  return {
    id,
    origin: String(tuple[1]),
    originSlot: Number(tuple[2]),
    target: String(tuple[3]),
    targetSlot: Number(tuple[4])
  }
}

/** `[id, origin, originSlot, target, targetSlot, type]` with both endpoints present and integer slots. */
function isLinkTuple(tuple: unknown, id: LinkId): tuple is readonly unknown[] {
  if (!Array.isArray(tuple) || tuple.length < 5) return false
  const [tupleId, origin, originSlot, target, targetSlot] = tuple
  return (
    tupleId === id &&
    origin != null &&
    target != null &&
    Number.isInteger(Number(originSlot)) &&
    Number.isInteger(Number(targetSlot))
  )
}

/**
 * A document node's slot names in document order (an unnamed slot record is
 * `undefined` at its position), or null when the document has no such node
 * or no slot list for it.
 */
export function readDocSlotNames(
  doc: Y.Doc,
  nodeId: string,
  kind: 'inputs' | 'outputs'
): readonly (string | undefined)[] | null {
  const node = nodesMap(doc).get(nodeId)
  if (!(node instanceof Y.Map)) return null
  const slots = node.get(kind)
  let list: unknown
  try {
    list = plain(slots)
  } catch {
    return null
  }
  if (!Array.isArray(list)) return null
  return list.map((entry: unknown) => {
    const name =
      typeof entry === 'object' && entry !== null && 'name' in entry
        ? entry.name
        : undefined
    return typeof name === 'string' ? name : undefined
  })
}

function readDocSlotName(
  doc: Y.Doc,
  nodeId: string,
  kind: 'inputs' | 'outputs',
  slot: number
): string | undefined {
  return readDocSlotNames(doc, nodeId, kind)?.[slot]
}

/** The document's value for a node's named widget, or undefined when it holds none. */
export function readDocWidgetValue(
  doc: Y.Doc,
  nodeId: string,
  widget: string
): unknown {
  const node = nodesMap(doc).get(nodeId)
  if (!(node instanceof Y.Map)) return undefined
  if (node.has('widgets') && node.has(OPAQUE_WIDGETS_KEY)) return undefined
  const widgets = node.get('widgets')
  if (widgets instanceof Y.Map && widgets.has(widget)) {
    try {
      return plain(widgets.get(widget))
    } catch {
      return undefined
    }
  }
  return readDocPromotedWidgetValue(doc, nodeId, widget)
}

export function docLinksIncident(doc: Y.Doc, nodeId: string): DocLink[] {
  const links: DocLink[] = []
  linksMap(doc).forEach((_, key) => {
    const link = readDocLink(doc, key)
    if (link && (link.origin === nodeId || link.target === nodeId))
      links.push(link)
  })
  return links
}

/**
 * Runs `fn` so that the first link it mints receives `id`. The live graph's
 * link counter is monotonic; seeding it one below the document id lets
 * `connect` mint the document's id through its normal path, and the counter
 * is restored to the higher of the two afterwards so later local mints never
 * collide with ids the document has already handed out.
 */
function withLinkId<T>(graph: LGraph, id: LinkId, fn: () => T): T {
  if (graph.links.has(id)) return fn()
  const { state } = graph
  const previous = state.lastLinkId
  state.lastLinkId = toLinkId(id - 1)
  try {
    return fn()
  } finally {
    state.lastLinkId = toLinkId(Math.max(previous, state.lastLinkId))
  }
}

function serializableWidgets(node: LGraphNode): IBaseWidget[] {
  return (node.widgets ?? []).filter((widget) => widget.serialize !== false)
}

/**
 * The document stores an ordinary node's widget values by name; `configure`
 * restores them positionally over the node's serializable widgets, so project
 * the named map into that order, keeping the constructor default for any
 * widget the document does not mention.
 */
function positionalWidgetValues(
  node: LGraphNode,
  widgets: DocNode['widgets']
): WidgetValue[] | undefined {
  if (widgets === undefined) return undefined
  if (Array.isArray(widgets)) {
    return widgets.map(
      (value): WidgetValue => (isWidgetValue(value) ? value : undefined)
    )
  }
  return serializableWidgets(node).map((widget): WidgetValue => {
    const value = widgets[widget.name]
    return widget.name in widgets && isWidgetValue(value) ? value : widget.value
  })
}

function missingNode(docNode: DocNode): LGraphNode {
  const node = new LGraphNode(
    docNode.serialised.title || docNode.type || 'Missing Node',
    docNode.type
  )
  node.has_errors = true
  return node
}

/**
 * A document may carry a size smaller than the node's widgets need (or none
 * at all). Every human path — `loadGraphData`, which the undo stack restores
 * through, and interactive resize — floors the size at `computeSize()`, so a
 * node born below that floor snapshots at one size and restores at another,
 * which the change tracker then records as a fresh edit.
 */
function floorSizeToContent(node: LGraphNode): void {
  const [minWidth, minHeight] = node.computeSize()
  const [width, height] = node.size
  if (width >= minWidth && height >= minHeight) return
  node.setSize([Math.max(width, minWidth), Math.max(height, minHeight)])
}

interface DefinitionState {
  live: object
  semantics: unknown
  layout: ReturnType<typeof definitionPromotedLayout>
  conflicted: boolean
}

function runtimeNodeSemantics(
  node: NonNullable<ExportedSubgraph['nodes']>[number]
): object {
  const {
    title: _title,
    pos: _pos,
    size: _size,
    flags: _flags,
    order: _order,
    shape: _shape,
    boxcolor: _boxcolor,
    color: _color,
    bgcolor: _bgcolor,
    showAdvanced: _showAdvanced,
    ...runtime
  } = node
  return runtime
}

function definitionSemantics(definition: ExportedSubgraph): unknown {
  const {
    name: _name,
    category: _category,
    description: _description,
    revision: _revision,
    state: _state,
    groups: _groups,
    reroutes: _reroutes,
    floatingLinks: _floatingLinks,
    extra: _extra,
    inputNode,
    outputNode,
    nodes,
    subgraphs,
    links,
    ...runtime
  } = definition
  return {
    ...runtime,
    inputNode: { id: inputNode.id },
    outputNode: { id: outputNode.id },
    nodes: nodes?.map(runtimeNodeSemantics),
    subgraphs: subgraphs?.map(runtimeNodeSemantics),
    links: links?.map(({ parentId: _parentId, ...link }) => link)
  }
}

function updateDefinitionConflict(
  state: DefinitionState,
  definition: ExportedSubgraph,
  layout: DefinitionState['layout']
): boolean {
  state.conflicted ||= !isEqual(
    state.semantics,
    definitionSemantics(definition)
  )
  if (state.layout === null) {
    if (!state.conflicted && layout !== null) state.layout = layout
    return state.conflicted
  }
  state.conflicted ||= layout === null || !isEqual(state.layout, layout)
  return state.conflicted
}

export class LiveGraphApplier {
  private readonly deps: LiveGraphApplierDeps
  private readonly reported = new Set<string>()
  private readonly definitionState = new WeakMap<
    LGraph,
    Map<string, DefinitionState>
  >()

  constructor(deps: LiveGraphApplierDeps) {
    this.deps = deps
  }

  /** Applies the collected changes of one delivered frame to the live graph. */
  applyChanges(
    doc: Y.Doc,
    changes: FrameChanges,
    context: RemoteApplyContext,
    mode: ApplyMode = 'merge'
  ): ApplyResult {
    const graph = this.deps.getGraph()
    if (!graph) return { createdNodeIds: [] }
    return this.write(graph, context, () => {
      if (mode === 'replace') this.removeAbsent(graph, doc, context)
      const created: NodeId[] = []
      const touchedNodes = new Set<string>()
      this.registerDefinitions(graph, doc)

      for (const [id, change] of changes.nodes) {
        if (change === 'delete') {
          this.try(context, () => this.deleteNode(graph, id))
          continue
        }
        touchedNodes.add(id)
        this.try(context, () => {
          const result = this.upsertNode(graph, doc, id, mode)
          if (result === 'created') created.push(toNodeId(id))
          if (result === 'recreated') {
            for (const link of docLinksIncident(doc, id)) {
              this.connectLink(graph, doc, link)
            }
          }
        })
      }

      for (const id of changes.resyncNodes) {
        if (touchedNodes.has(id)) continue
        this.try(context, () => this.syncFields(graph, doc, id))
      }

      for (const [id, names] of changes.widgets) {
        if (touchedNodes.has(id)) continue
        this.try(context, () => this.syncWidgets(graph, doc, id, names, mode))
      }

      this.applyLinks(graph, doc, [...changes.links], context)
      if (mode === 'merge') this.placeBatch(graph, created)
      return { createdNodeIds: created }
    })
  }

  private removeAbsent(
    graph: LGraph,
    doc: Y.Doc,
    context: RemoteApplyContext
  ): void {
    const docNodes = nodesMap(doc)
    const absentNodes = graph._nodes.filter(
      (node) => !docNodes.has(String(node.id))
    )
    for (const node of absentNodes) {
      this.try(context, () => graph.remove(node))
    }
    const docLinks = linksMap(doc)
    for (const id of graph.links.keys()) {
      if (docLinks.has(String(id))) continue
      this.try(context, () => graph.removeLink(id))
    }
  }

  /**
   * One frame is one change: the same `before-change`/`after-change` bracket
   * a multi-step human edit emits, so the change tracker records a single
   * undo entry and flips `isModified` once.
   */
  private write<T>(graph: LGraph, context: RemoteApplyContext, fn: () => T): T {
    const withActor = this.deps.withRemoteActor ?? ((_, run) => run())
    return withActor(context.actor, () => {
      graph.canvasAction((canvas) => canvas.emitBeforeChange())
      try {
        return withGraphIntentSource('agent-remote', fn)
      } finally {
        graph.setDirtyCanvas(true, true)
        graph.canvasAction((canvas) => canvas.emitAfterChange())
      }
    })
  }

  private try(context: RemoteApplyContext, fn: () => void): void {
    try {
      fn()
    } catch (error) {
      reportError(error, {
        surface: 'agent',
        errorType: 'agent_graph_apply_failed',
        tags: { ...AGENT_APPLY_TAGS, outcome: 'degraded' },
        context: { actor: context.actor, opIds: [...context.opIds] }
      })
    }
  }

  private reportOnce(
    key: string,
    message: string,
    errorType: string,
    context: Record<string, unknown>
  ): void {
    if (this.reported.has(key)) return
    this.reported.add(key)
    reportError(new Error(message), {
      surface: 'agent',
      errorType,
      tags: { ...AGENT_APPLY_TAGS, outcome: 'degraded' },
      context
    })
  }

  private registerDefinitions(graph: LGraph, doc: Y.Doc): void {
    const rootGraph = graph.rootGraph
    const definitions = allSubgraphDefinitions(
      readSubgraphDefinitions(doc)
    ).map((definition) => ({ ...definition, definitions: undefined }))
    const state = this.definitionStates(rootGraph)
    const missing = definitions.filter((definition) =>
      this.observeDefinition(graph, doc, definition, state)
    )
    if (missing.length === 0) return
    const reserved = docRootIds(doc)
    for (const definition of topologicalSortSubgraphs(missing)) {
      this.registerDefinition(graph, doc, definition, reserved, state)
    }
  }

  private definitionStates(rootGraph: LGraph): Map<string, DefinitionState> {
    const existing = this.definitionState.get(rootGraph)
    if (existing) return existing
    const created = new Map<string, DefinitionState>()
    this.definitionState.set(rootGraph, created)
    return created
  }

  /** Returns true when this definition still needs to be registered live. */
  private observeDefinition(
    graph: LGraph,
    doc: Y.Doc,
    definition: ExportedSubgraph,
    state: Map<string, DefinitionState>
  ): boolean {
    const live = graph.rootGraph.subgraphs.get(definition.id)
    if (!live) return true
    const previous = state.get(definition.id)
    if (previous?.live !== live) {
      state.set(definition.id, {
        live,
        semantics: definitionSemantics(definition),
        layout: readDefinitionPromotedLayout(doc, definition.id),
        conflicted: false
      })
      return false
    }
    const layout = readDefinitionPromotedLayout(doc, definition.id)
    if (updateDefinitionConflict(previous, definition, layout)) {
      this.reportOnce(
        `definition-changed:${definition.id}`,
        `Document subgraph definition ${definition.id} changed while its live definition remained registered; refusing host updates until the graph reloads`,
        'agent_subgraph_definition_changed',
        { graphId: graph.id, definitionId: definition.id }
      )
    }
    return false
  }

  private registerDefinition(
    graph: LGraph,
    doc: Y.Doc,
    definition: ExportedSubgraph,
    reserved: { nodeIds: NodeId[]; linkIds: number[] },
    state: Map<string, DefinitionState>
  ): void {
    const failure = tryCreateSubgraph(graph.rootGraph, definition, reserved)
    if (failure !== undefined) {
      this.reportDefinitionFailure(graph, definition.id, failure)
      return
    }
    this.reported.delete(`definition:${definition.id}`)
    const live = graph.rootGraph.subgraphs.get(definition.id)
    if (live)
      state.set(definition.id, {
        live,
        semantics: definitionSemantics(definition),
        layout: readDefinitionPromotedLayout(doc, definition.id),
        conflicted: false
      })
  }

  private reportDefinitionFailure(
    graph: LGraph,
    definitionId: string,
    failure: unknown
  ): void {
    if (this.reported.has(`definition:${definitionId}`)) return
    this.reported.add(`definition:${definitionId}`)
    reportError(failure, {
      surface: 'agent',
      errorType: 'agent_subgraph_definitions_failed',
      tags: { ...AGENT_APPLY_TAGS, outcome: 'degraded' },
      context: { graphId: graph.id, definitionId }
    })
  }

  private hasDefinitionConflict(node: LGraphNode): boolean {
    return (
      node.graph !== null &&
      this.definitionState.get(node.graph.rootGraph)?.get(node.type)
        ?.conflicted === true
    )
  }

  private deleteNode(graph: LGraph, id: string): void {
    const node = graph.getNodeById(toNodeId(id))
    if (node) graph.remove(node)
  }

  private upsertNode(
    graph: LGraph,
    doc: Y.Doc,
    id: string,
    mode: ApplyMode
  ): 'created' | 'recreated' | 'updated' | 'skipped' {
    const docNode = this.readDocNode(doc, id)
    if (!docNode) return 'skipped'
    const definitionConflicted =
      this.definitionState.get(graph.rootGraph)?.get(docNode.type)
        ?.conflicted === true
    const live = graph.getNodeById(toNodeId(id))
    if (live && live.type === docNode.type) {
      this.applyFields(live, docNode)
      if (!definitionConflicted)
        this.applyWidgets(live, docNode.widgets, mode, doc)
      return 'updated'
    }
    if (live) graph.remove(live)
    this.createNode(graph, doc, docNode, mode)
    return live ? 'recreated' : 'created'
  }

  private createNode(
    graph: LGraph,
    doc: Y.Doc,
    docNode: DocNode,
    mode: ApplyMode
  ): LGraphNode {
    const node =
      LiteGraph.createNode(docNode.type, docNode.serialised.title) ??
      missingNode(docNode)
    node.id = toNodeId(docNode.id)
    const info: ISerialisedNode = {
      ...docNode.serialised,
      inputs: docNode.serialised.inputs?.map(
        (input): ISerialisableNodeInput => ({ ...input })
      ),
      outputs: docNode.serialised.outputs?.map(
        (output): ISerialisableNodeOutput => ({ ...output })
      )
    }
    detachSerialisedLinks(info)
    node.pos = [info.pos[0], info.pos[1]]
    graph.add(node)
    if (node.id !== toNodeId(docNode.id)) {
      this.reportOnce(
        `node-id:${docNode.id}`,
        `Live graph reminted node ${docNode.id} as ${String(node.id)}`,
        'agent_graph_node_id_reminted',
        { nodeId: docNode.id, liveId: node.id }
      )
    }
    if (node.has_errors) {
      node.last_serialization = info
      node.configure(info)
    } else {
      if (node.isSubgraphNode()) {
        const beforeConfigurePromotedIds = promotedWidgetIds(node)
        node.configure(info)
        this.applyConfiguredHostWidgets(
          node,
          docNode.widgets,
          beforeConfigurePromotedIds,
          mode,
          doc,
          docNode.id
        )
      } else {
        node.configure({
          ...info,
          widgets_values: positionalWidgetValues(node, docNode.widgets)
        })
      }
    }
    floorSizeToContent(node)
    return node
  }

  private applyFields(node: LGraphNode, docNode: DocNode): void {
    const source = docNode.serialised
    if (source.title !== undefined && node.title !== source.title)
      node.title = source.title
    if (node.mode !== source.mode) node.mode = source.mode
    const { ghost } = node.flags
    node.flags = ghost === undefined ? source.flags : { ...source.flags, ghost }
    for (const [key, value] of Object.entries(source.properties ?? {})) {
      if (node.properties[key] !== value) node.setProperty(key, value)
    }
    applyAppearance(node, source)
  }

  private readDocNode(doc: Y.Doc, id: string): DocNode | null {
    const read = readDocNode(doc, id)
    if (read === null) return null
    const key = `node-shape:${id}`
    if (!('malformed' in read)) {
      if (read.widgetIssue) {
        this.reportOnce(
          key,
          `Document node ${id} (${read.type}) has unreadable widget storage: ${read.widgetIssue}`,
          'agent_graph_node_malformed',
          {
            nodeId: id,
            issues: read.widgetIssue,
            classType: read.type,
            valueShapes: 'widgets named+opaque',
            producer: nodeProducer(doc, id)
          }
        )
      } else {
        this.reported.delete(key)
      }
      return read
    }
    if (this.reported.has(key)) return null
    const { classType, valueShapes, producer } = read.discriminate()
    this.reportOnce(
      key,
      `Document node ${id} (${classType ?? 'unknown class'}) is malformed: ${read.malformed}`,
      'agent_graph_node_malformed',
      { nodeId: id, issues: read.malformed, classType, valueShapes, producer }
    )
    return null
  }

  private syncFields(graph: LGraph, doc: Y.Doc, id: string): void {
    const docNode = this.readDocNode(doc, id)
    const node = graph.getNodeById(toNodeId(id))
    if (!docNode || !node || node.type !== docNode.type) return
    this.applyFields(node, docNode)
  }

  private syncWidgets(
    graph: LGraph,
    doc: Y.Doc,
    id: string,
    names: ReadonlySet<string> | 'all',
    mode: ApplyMode
  ): void {
    const docNode = this.readDocNode(doc, id)
    const node = graph.getNodeById(toNodeId(id))
    if (!docNode || !node || node.type !== docNode.type) return
    const widgets = docNode.widgets
    if (names === 'all' || Array.isArray(widgets)) {
      this.applyWidgets(node, widgets, mode, doc)
      return
    }
    if (!widgets) return
    this.applyWidgets(
      node,
      Object.fromEntries(
        Object.entries(widgets).filter(([name]) => names.has(name))
      ),
      mode,
      doc
    )
  }

  private applyWidgets(
    node: LGraphNode,
    widgets: DocNode['widgets'],
    mode: ApplyMode,
    doc: Y.Doc
  ): void {
    if (widgets === undefined) return
    if (node.isSubgraphNode()) {
      this.applySubgraphWidgets(node, widgets, mode, doc)
      return
    }
    this.applyOrdinaryWidgets(node, widgets)
  }

  private applySubgraphWidgets(
    node: LGraphNode,
    widgets: NonNullable<DocNode['widgets']>,
    mode: ApplyMode,
    doc: Y.Doc
  ): void {
    if (this.hasDefinitionConflict(node)) return
    if (!Array.isArray(widgets)) {
      this.reportNamedHostWidgets(node, mode)
      return
    }
    this.applyHostWidgets(node, widgets, mode, doc)
  }

  private reportNamedHostWidgets(node: LGraphNode, mode: ApplyMode): void {
    this.reportOnce(
      `host-widgets-named:${String(node.id)}`,
      `Subgraph host ${String(node.id)} carries named widget storage; refusing positional host updates`,
      'agent_graph_host_widgets_named',
      { nodeId: node.id, mode }
    )
  }

  private applyOrdinaryWidgets(
    node: LGraphNode,
    widgets: NonNullable<DocNode['widgets']>
  ): void {
    const entries = Array.isArray(widgets)
      ? serializableWidgets(node).map((widget, index): [string, unknown] => [
          widget.name,
          widgets[index]
        ])
      : Object.entries(widgets)
    for (const [name, value] of entries) {
      if (value === undefined || !isWidgetValue(value)) continue
      if (this.holdsLocalWrite(node, name, value)) continue
      const widget = node.widgets?.find((candidate) => candidate.name === name)
      if (!widget) {
        this.reportOnce(
          `widget:${String(node.id)}:${name}`,
          `Node ${String(node.id)} (${node.type}) has no widget '${name}'`,
          'agent_graph_widget_missing',
          { nodeId: node.id, type: node.type, name }
        )
        continue
      }
      this.setWidgetValue(node, widget, value)
    }
  }

  private applyConfiguredHostWidgets(
    node: LGraphNode,
    widgets: DocNode['widgets'],
    beforeConfigurePromotedIds: readonly string[],
    mode: ApplyMode,
    doc: Y.Doc,
    docNodeId: string
  ): void {
    if (widgets !== undefined && !Array.isArray(widgets)) {
      this.reportNamedHostWidgets(node, mode)
      return
    }
    const afterConfigurePromotedIds = promotedWidgetIds(node)
    if (
      Array.isArray(widgets) &&
      (widgets.length !== afterConfigurePromotedIds.length ||
        !isEqual(beforeConfigurePromotedIds, afterConfigurePromotedIds))
    ) {
      this.reportHostWidgetDrift(
        node,
        widgets.length,
        afterConfigurePromotedIds.length,
        mode,
        { beforeConfigurePromotedIds, afterConfigurePromotedIds }
      )
      return
    }
    this.applyHostWidgets(node, widgets, mode, doc, docNodeId)
  }

  private reportHostWidgetDrift(
    node: LGraphNode,
    actual: number,
    expected: number,
    mode: ApplyMode,
    identity?: {
      beforeConfigurePromotedIds?: readonly string[]
      afterConfigurePromotedIds?: readonly string[]
      docPromotedNames?: readonly string[] | null
      livePromotedNames?: readonly string[]
    }
  ): void {
    this.reportOnce(
      `host-widgets:${mode}:${String(node.id)}`,
      `Subgraph host ${String(node.id)} (${node.type}) carries ${actual} opaque widget values for ${expected} promoted widgets`,
      'agent_graph_host_widgets_mismatch',
      { nodeId: node.id, type: node.type, expected, actual, mode, ...identity }
    )
  }

  private applyHostWidgets(
    node: LGraphNode,
    widgets: DocNode['widgets'],
    mode: ApplyMode,
    doc: Y.Doc,
    docNodeId: string = String(node.id)
  ): void {
    const promoted = promotedInputs(node)
    if (Array.isArray(widgets)) {
      const identity = promotedLayoutIdentity(
        doc,
        docNodeId,
        promoted,
        widgets.length
      )
      if (!identity.matches) {
        this.reportHostWidgetDrift(
          node,
          widgets.length,
          promoted.length,
          mode,
          {
            docPromotedNames: identity.docPromotedNames,
            livePromotedNames: identity.livePromotedNames
          }
        )
        return
      }
    }
    for (const [name, value] of hostWidgetEntries(promoted, widgets)) {
      if (!isWidgetValue(value)) continue
      if (this.holdsLocalWrite(node, name, value)) continue
      const widget = node.widgets?.find((candidate) => candidate.name === name)
      if (!widget) {
        this.reportOnce(
          `widget:${String(node.id)}:${name}`,
          `Subgraph host ${String(node.id)} (${node.type}) promotes no widget '${name}'`,
          'agent_graph_widget_missing',
          { nodeId: node.id, type: node.type, name }
        )
        continue
      }
      this.setWidgetValue(node, widget, value)
    }
  }

  private holdsLocalWrite(
    node: LGraphNode,
    widget: string,
    docValue: WidgetValue
  ): boolean {
    return (
      this.deps.holdsLocalWrite?.(String(node.id), widget, docValue) ?? false
    )
  }

  private setWidgetValue(
    node: LGraphNode,
    widget: IBaseWidget,
    value: WidgetValue
  ) {
    if (widget.type === 'button' || Object.is(widget.value, value)) return
    const previous = widget.value
    writeWidgetValue(node, widget, value)
    this.invokeWidgetHook(node, widget, value, 'widget-callback', () =>
      widget.callback?.(value, this.deps.getCanvas?.() ?? undefined, node)
    )
    this.invokeWidgetHook(node, widget, value, 'widget-changed', () =>
      node.onWidgetChanged?.(widget.name, value, previous, widget)
    )
    node.graph?.incrementVersion()
  }

  /**
   * A document register has already been consumed before either hook runs.
   * Preserve that canonical value and let sibling widgets continue if an
   * extension hook mutates and then throws; no later delta is guaranteed.
   */
  private invokeWidgetHook(
    node: LGraphNode,
    widget: IBaseWidget,
    value: WidgetValue,
    key: string,
    invoke: () => void
  ): void {
    try {
      invoke()
    } catch (error) {
      this.reportOnce(
        `${key}:${String(node.id)}:${widget.name}`,
        error instanceof Error ? error.message : String(error),
        'agent_graph_widget_callback_failed',
        { nodeId: node.id, widget: widget.name }
      )
      writeWidgetValue(node, widget, value)
    }
  }

  private applyLinks(
    graph: LGraph,
    doc: Y.Doc,
    keys: readonly string[],
    context: RemoteApplyContext
  ): void {
    const retry: DocLink[] = []
    for (const key of keys) {
      const link = readDocLink(doc, key)
      if (!link) {
        const id = parseLinkId(key)
        if (id !== undefined)
          this.try(context, () => graph.removeLink(toLinkId(id)))
        continue
      }
      this.try(context, () => {
        if (this.connectLink(graph, doc, link) === 'unresolved')
          retry.push(link)
      })
    }
    for (const link of retry) {
      this.try(context, () => {
        if (this.connectLink(graph, doc, link) !== 'connected') {
          this.reportOnce(
            `link:${link.id}`,
            `Link ${link.id} (node ${link.origin} slot ${link.originSlot} -> node ${link.target} slot ${link.targetSlot}) could not be connected on the live graph`,
            'agent_graph_link_unresolved',
            { ...link }
          )
        }
      })
    }
  }

  private connectLink(
    graph: LGraph,
    doc: Y.Doc,
    link: DocLink
  ): 'connected' | 'present' | 'unresolved' | 'refused' | 'missing-node' {
    const origin = graph.getNodeById(toNodeId(link.origin))
    const target = graph.getNodeById(toNodeId(link.target))
    if (!origin || !target) return 'missing-node'

    const originSlot = resolveSlot(
      origin.outputs.map((output) => output.name),
      readDocSlotName(doc, link.origin, 'outputs', link.originSlot),
      link.originSlot,
      'positional'
    )
    const targetSlot = resolveTargetSlot(target, doc, link)
    if (originSlot < 0 || targetSlot < 0) {
      if (graph.links.has(link.id)) graph.removeLink(link.id)
      return 'unresolved'
    }
    if (isLinkPresent(graph, origin, originSlot, target, targetSlot))
      return 'present'
    if (graph.links.has(link.id)) graph.removeLink(link.id)

    const created = withLinkId(graph, link.id, () =>
      origin.connect(originSlot, target, targetSlot)
    )
    return created ? 'connected' : 'refused'
  }

  private placeBatch(graph: LGraph, created: readonly NodeId[]): void {
    if (created.length === 0) return
    const createdSet = new Set(created)
    const rect = (node: LGraphNode): PlacementRect => ({
      x: node.pos[0],
      y: node.pos[1],
      width: node.size[0],
      height: node.size[1]
    })
    const incoming = graph._nodes.filter((node) => createdSet.has(node.id))
    const offset = placementOffset({
      existing: graph._nodes
        .filter((node) => !createdSet.has(node.id))
        .map(rect),
      viewport: this.deps.viewportBounds?.() ?? null,
      incoming: incoming.map(rect)
    })
    if (!offset) return
    for (const node of incoming) {
      node.pos = [node.pos[0] + offset.dx, node.pos[1] + offset.dy]
    }
  }
}

function isLinkPresent(
  graph: LGraph,
  origin: LGraphNode,
  originSlot: number,
  target: LGraphNode,
  targetSlot: number
): boolean {
  const currentId = target.inputs[targetSlot]?.link
  const current = currentId == null ? undefined : graph.links.get(currentId)
  return (
    current !== undefined &&
    current.origin_id === origin.id &&
    current.origin_slot === originSlot
  )
}

function promotedInputs(node: LGraphNode): INodeInputSlot[] {
  return node.inputs.filter((input) => input.widgetId)
}

function promotedWidgetIds(node: LGraphNode): string[] {
  return promotedInputs(node).flatMap((input) =>
    input.widgetId ? [input.widgetId] : []
  )
}

/** Host widget values by promoted-input name; a positional list is read in promoted-input order. */
function hostWidgetEntries(
  promoted: readonly INodeInputSlot[],
  widgets: DocNode['widgets']
): [string, unknown][] {
  if (Array.isArray(widgets))
    return promoted.map((input, index) => [input.name, widgets[index]])
  return Object.entries(widgets ?? {})
}

function promotedLayoutIdentity(
  doc: Y.Doc,
  docNodeId: string,
  promoted: readonly INodeInputSlot[],
  valueCount: number
): {
  matches: boolean
  docPromotedNames: readonly string[] | null
  livePromotedNames: readonly string[]
} {
  const docPromotedNames =
    readDocPromotedWidgets(doc, docNodeId)?.promotedNames ?? null
  const livePromotedNames = promoted.map((input) => input.name)
  return {
    matches:
      valueCount === livePromotedNames.length &&
      docPromotedNames !== null &&
      docPromotedNames.length === livePromotedNames.length &&
      docPromotedNames.every(
        (name, index) => name === livePromotedNames[index]
      ),
    docPromotedNames,
    livePromotedNames
  }
}

/** Writes a widget value and its mirrored node property. */
function writeWidgetValue(
  node: LGraphNode,
  widget: IBaseWidget,
  value: WidgetValue
): void {
  const property = widget.options.property
  if (!property || node.properties[property] === undefined) {
    widget.value = value
    return
  }
  widget.value = value
  node.setProperty(property, value)
}

function applyAppearance(node: LGraphNode, source: ISerialisedNode): void {
  for (const key of SYNCED_APPEARANCE_FIELDS) {
    const value = source[key]
    if (value !== undefined && node[key] !== value) {
      Object.assign(node, { [key]: value })
    }
  }
}

/**
 * The live input index a document link targets. A dynamic input slot the host
 * grew has no live counterpart until the node's autogrow group is grown to it,
 * so grow it rather than drop a link the document holds against a slot it
 * legitimately owns. `growAutogrowInput` refuses a name outside the node's own
 * groups, leaving a slot the live node really lacks unresolved as before.
 */
function resolveTargetSlot(
  target: LGraphNode,
  doc: Y.Doc,
  link: DocLink
): number {
  const docName = readDocSlotName(doc, link.target, 'inputs', link.targetSlot)
  const resolved = resolveSlot(
    target.inputs.map((input) => input.name),
    docName,
    link.targetSlot,
    'none'
  )
  if (resolved >= 0 || docName === undefined) return resolved
  return growAutogrowInput(target, docName) ?? resolved
}

/**
 * Resolves a document slot to a live slot index, by name first. `ComfyNode.configure`
 * keeps every document input name live (definition or extra), so an input
 * name the live node lacks is a real mismatch and never a positional guess.
 * It matches outputs by index and lets the definition's names win over the
 * document's, so an output resolves by position when its document name is
 * stale.
 */
function resolveSlot(
  liveNames: readonly string[],
  docName: string | undefined,
  docIndex: number,
  fallback: 'positional' | 'none'
): number {
  const byName = docName === undefined ? -1 : liveNames.indexOf(docName)
  if (byName >= 0 || (docName !== undefined && fallback === 'none')) {
    return byName
  }
  return docIndex < liveNames.length ? docIndex : -1
}

/**
 * Root ids the document owns. Definitions register before the frame's root
 * nodes and links exist live, so id deduplication has to be told about them
 * or it hands a definition interior an id the root graph is about to need.
 */
function docRootIds(doc: Y.Doc): { nodeIds: NodeId[]; linkIds: number[] } {
  const nodeIds: NodeId[] = []
  nodesMap(doc).forEach((_, id) => nodeIds.push(toNodeId(id)))
  const linkIds: number[] = []
  linksMap(doc).forEach((_, key) => {
    const id = parseLinkId(key)
    if (id !== undefined) linkIds.push(id)
  })
  return { nodeIds, linkIds }
}

function tryCreateSubgraph(
  rootGraph: LGraph,
  definition: ExportedSubgraph,
  reserved: { nodeIds: NodeId[]; linkIds: number[] }
): unknown {
  if (!isUuidShapedSubgraphId(definition.id)) {
    return new Error(
      `Agent subgraph definition id is not a UUID: ${definition.id}`
    )
  }
  try {
    withNamedValuesRestore(() =>
      rootGraph.createSubgraphs([definition], reserved)
    )
    return undefined
  } catch (cause) {
    const halfBuilt = rootGraph.subgraphs.get(definition.id)
    if (halfBuilt) {
      try {
        rootGraph.releaseSubgraphs([halfBuilt])
      } catch (rollbackCause) {
        return new AggregateError(
          [cause, rollbackCause],
          `Agent subgraph definition ${definition.id} failed to register and roll back`
        )
      }
    }
    return cause
  }
}

/**
 * Definitions carry interior widget values by name
 * (`widgets_values_named`); `configure` only reads them while the
 * `namedValuesRestore` flag is set, so set it for the definition alone.
 */
function withNamedValuesRestore<T>(fn: () => T): T {
  const previous = LiteGraph.namedValuesRestore
  LiteGraph.namedValuesRestore = true
  try {
    return fn()
  } finally {
    LiteGraph.namedValuesRestore = previous
  }
}
