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
import { inputSpecTree } from '@/schemas/nodeDef/inputSpecTree'
import { isUuidShapedSubgraphId } from '@/schemas/subgraphIdSchema'
import type { LinkId } from '@/types/linkId'
import { parseLinkId, toLinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'

import {
  allSubgraphDefinitions,
  readSubgraphDefinitions
} from './agentSubgraphDefinitions'
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
}

interface DocLink {
  id: LinkId
  origin: string
  originSlot: number
  target: string
  targetSlot: number
}

interface ApplyWidgetOptions {
  documentWidgets?: DocNode['widgets']
  reportMissing?: boolean
}

function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
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

function readDocNode(
  doc: Y.Doc,
  id: string
): DocNode | MalformedDocNode | null {
  const source = nodesMap(doc).get(id)
  if (!(source instanceof Y.Map)) return null

  const fields: Record<string, unknown> = { id }
  let widgets: DocNode['widgets']
  source.forEach((value, key) => {
    if (key === 'widgets' && value instanceof Y.Map) {
      widgets = value.toJSON()
    } else if (key === OPAQUE_WIDGETS_KEY) {
      const opaque = plain(value)
      if (Array.isArray(opaque)) widgets = opaque
    } else if (key !== 'id') {
      fields[key] = plain(value)
    }
  })
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
  return { id, type: serialised.type, serialised, widgets }
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
  const slots = nodesMap(doc).get(nodeId)?.get(kind)
  const list: unknown = slots instanceof Y.Array ? slots.toJSON() : slots
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
  const widgets = nodesMap(doc).get(nodeId)?.get('widgets')
  return widgets instanceof Y.Map ? plain(widgets.get(widget)) : undefined
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

function supportsDynamicWidgetOverflow(node: LGraphNode): boolean {
  const inputs = node.constructor.nodeData?.inputs
  return (
    inputs !== undefined &&
    Object.values(inputs).some((spec) =>
      inputSpecTree(spec).some(({ type }) => type === 'COMFY_DYNAMICCOMBO_V3')
    )
  )
}

const OVERFLOW_WIDGET_NAME_RE = /^_extra_(0|[1-9]\d*)$/

function overflowWidgetIndex(name: string): number | null {
  const match = OVERFLOW_WIDGET_NAME_RE.exec(name)
  return match ? Number(match[1]) : null
}

function documentWidget(
  node: LGraphNode,
  name: string
): IBaseWidget | undefined {
  return (
    node.widgets?.find((widget) => widget.name === name) ??
    overflowWidget(node, name)
  )
}

/** The live widget an overflow alias addresses, if the node has that position. */
function overflowWidget(
  node: LGraphNode,
  name: string
): IBaseWidget | undefined {
  if (!supportsDynamicWidgetOverflow(node)) return undefined
  const overflowIndex = overflowWidgetIndex(name)
  return overflowIndex === null
    ? undefined
    : serializableWidgets(node).at(overflowIndex)
}

/**
 * Whether `name` is an overflow alias for a position the document also
 * addresses by the live widget's real name; the named entry wins. Judged
 * against the node's whole document map so an alias-only partial frame cannot
 * overwrite the named value.
 */
function supersededOverflowAlias(
  node: LGraphNode,
  name: string,
  document: DocNode['widgets']
): boolean {
  if (document === undefined || Array.isArray(document)) return false
  if (node.widgets?.some((widget) => widget.name === name)) return false
  const positional = overflowWidget(node, name)
  return positional !== undefined && Object.hasOwn(document, positional.name)
}

/**
 * Document entries for widgets that only exist after `configure`: aliases past
 * the constructed list, and names the constructor did not build but the node
 * now serializes. `constructed` is the serializable list from before
 * `configure`; a name that still matches nothing is dropped without a report.
 */
function mountedWidgetValues(
  node: LGraphNode,
  widgets: DocNode['widgets'],
  constructed: readonly IBaseWidget[],
  constructedNames: ReadonlySet<string>
): Record<string, unknown> | undefined {
  if (widgets === undefined || Array.isArray(widgets)) return undefined
  const mounted = Object.entries(widgets).filter(([name]) => {
    const index = overflowWidgetIndex(name)
    return index === null
      ? !constructedNames.has(name)
      : overflowWidget(node, name) === undefined || index >= constructed.length
  })
  return mounted.length === 0 ? undefined : Object.fromEntries(mounted)
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
  return serializableWidgets(node).map((widget, index) => {
    const alias = `_extra_${index}`
    const name = Object.hasOwn(widgets, widget.name)
      ? widget.name
      : overflowWidget(node, alias) === widget && Object.hasOwn(widgets, alias)
        ? alias
        : widget.name
    const value = widgets[name]
    return Object.hasOwn(widgets, name) && isWidgetValue(value)
      ? value
      : widget.value
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

export class LiveGraphApplier {
  private readonly deps: LiveGraphApplierDeps
  private readonly reported = new Set<string>()

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
        context: {
          actorKind: actorKind(context.actor),
          opIds: [...context.opIds]
        }
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
    const missing = allSubgraphDefinitions(readSubgraphDefinitions(doc))
      .map((definition) => ({ ...definition, definitions: undefined }))
      .filter((definition) => !rootGraph.subgraphs.has(definition.id))
    if (missing.length === 0) return
    const reserved = docRootIds(doc)
    for (const definition of topologicalSortSubgraphs(missing)) {
      const failure = tryCreateSubgraph(rootGraph, definition, reserved)
      if (failure === undefined) {
        this.reported.delete(`definition:${definition.id}`)
        continue
      }
      if (this.reported.has(`definition:${definition.id}`)) continue
      this.reported.add(`definition:${definition.id}`)
      reportError(failure, {
        surface: 'agent',
        errorType: 'agent_subgraph_definitions_failed',
        tags: { ...AGENT_APPLY_TAGS, outcome: 'degraded' },
        context: { graphId: graph.id, definitionId: definition.id }
      })
    }
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
    const live = graph.getNodeById(toNodeId(id))
    if (live && live.type === docNode.type) {
      this.applyFields(live, docNode)
      this.applyWidgets(live, docNode.widgets, mode)
      return 'updated'
    }
    if (live) graph.remove(live)
    this.createNode(graph, docNode, mode)
    return live ? 'recreated' : 'created'
  }

  private createNode(
    graph: LGraph,
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
          mode
        )
      } else {
        const constructed = serializableWidgets(node)
        const constructedNames = new Set(
          node.widgets?.map((widget) => widget.name)
        )
        node.configure({
          ...info,
          widgets_values: positionalWidgetValues(node, docNode.widgets)
        })
        const mounted = mountedWidgetValues(
          node,
          docNode.widgets,
          constructed,
          constructedNames
        )
        if (mounted)
          this.applyWidgets(node, mounted, mode, {
            documentWidgets: docNode.widgets,
            reportMissing: false
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
      this.reported.delete(key)
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
      this.applyWidgets(node, widgets, mode)
      return
    }
    if (!widgets) return
    this.applyWidgets(
      node,
      Object.fromEntries(
        Object.entries(widgets).filter(([name]) => changed(node, name, names))
      ),
      mode,
      { documentWidgets: widgets }
    )
  }

  /**
   * `options.documentWidgets` is the node's whole document map. It differs
   * from `widgets` on partial frames, where alias precedence still depends on
   * every key. Creation can suppress reports for unmatched names while still
   * reporting unresolved overflow aliases.
   */
  private applyWidgets(
    node: LGraphNode,
    widgets: DocNode['widgets'],
    mode: ApplyMode,
    options: ApplyWidgetOptions = {}
  ): void {
    if (widgets === undefined) return
    if (node.isSubgraphNode()) {
      this.applyHostWidgets(node, widgets, mode)
      return
    }
    const { documentWidgets = widgets, reportMissing = true } = options
    let pending = ordinaryWidgetEntries(node, widgets).filter(isWidgetEntry)
    while (pending.length > 0) {
      const { resolved, unresolved } = this.applyWidgetRound(
        node,
        pending,
        documentWidgets
      )
      if (!resolved) {
        this.reportMissingWidgets(node, unresolved, reportMissing)
        return
      }
      pending = unresolved
    }
  }

  private applyWidgetRound(
    node: LGraphNode,
    pending: readonly [string, WidgetValue][],
    documentWidgets: DocNode['widgets']
  ): { resolved: boolean; unresolved: [string, WidgetValue][] } {
    const unresolved: [string, WidgetValue][] = []
    let resolved = false
    for (const [name, value] of pending) {
      if (supersededOverflowAlias(node, name, documentWidgets)) continue
      if (this.holdsLocalWrite(node, name, value)) continue
      const widget = documentWidget(node, name)
      if (widget === undefined) {
        unresolved.push([name, value])
        continue
      }
      if (
        widget.name !== name &&
        this.holdsLocalWrite(node, widget.name, value)
      )
        continue
      this.setWidgetValue(node, widget, value)
      resolved = true
    }
    return { resolved, unresolved }
  }

  private reportMissingWidgets(
    node: LGraphNode,
    unresolved: readonly [string, WidgetValue][],
    reportMissing: boolean
  ): void {
    for (const [name] of unresolved) {
      if (reportMissing || overflowWidgetIndex(name) !== null)
        this.reportMissingWidget(node, name)
    }
  }

  private reportMissingWidget(node: LGraphNode, name: string): void {
    this.reportOnce(
      `widget:${String(node.id)}:${name}`,
      `Node ${String(node.id)} (${node.type}) has no widget '${name}'`,
      'agent_graph_widget_missing',
      { nodeId: node.id, type: node.type, name }
    )
  }

  private applyConfiguredHostWidgets(
    node: LGraphNode,
    widgets: DocNode['widgets'],
    beforeConfigurePromotedIds: readonly string[],
    mode: ApplyMode
  ): void {
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
    this.applyHostWidgets(node, widgets, mode)
  }

  private reportHostWidgetDrift(
    node: LGraphNode,
    actual: number,
    expected: number,
    mode: ApplyMode,
    identity?: {
      beforeConfigurePromotedIds: readonly string[]
      afterConfigurePromotedIds: readonly string[]
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
    mode: ApplyMode
  ): void {
    const promoted = promotedInputs(node)
    if (Array.isArray(widgets) && widgets.length !== promoted.length) {
      this.reportHostWidgetDrift(node, widgets.length, promoted.length, mode)
      return
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
    const rollback = writeWidgetValue(node, widget, value)
    try {
      widget.callback?.(value, this.deps.getCanvas?.() ?? undefined, node)
      node.onWidgetChanged?.(widget.name, value, previous, widget)
    } catch (error) {
      rollback()
      throw error
    }
    node.graph?.incrementVersion()
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

/** Rank of a not-yet-mounted document name; past every live/overflow position. */
const MOUNTED_LAST = Number.MAX_SAFE_INTEGER

/**
 * Apply order for a document widget map: live widgets in their positional
 * order, then overflow aliases by position, then names no widget carries yet.
 * The live order keeps a selector ahead of children it may rebuild. Unresolved
 * entries are retried after each round, so selectors can mount widgets at any
 * depth.
 */
function widgetEntryRank(node: LGraphNode, name: string): number {
  const live = serializableWidgets(node)
  const liveIndex = live.findIndex((widget) => widget.name === name)
  if (liveIndex !== -1) return liveIndex
  const index = overflowWidgetIndex(name)
  return index === null ? MOUNTED_LAST : live.length + index
}

function isWidgetEntry(
  entry: [string, unknown]
): entry is [string, WidgetValue] {
  return entry[1] !== undefined && isWidgetValue(entry[1])
}

/**
 * Ordinary node widget values by document name, ordered so Y.Map insertion
 * order cannot decide the outcome (`widgetEntryRank`); a positional list is
 * read in serializable-widget order.
 */
function ordinaryWidgetEntries(
  node: LGraphNode,
  widgets: NonNullable<DocNode['widgets']>
): [string, unknown][] {
  if (!Array.isArray(widgets)) {
    return Object.entries(widgets).sort(
      ([a], [b]) => widgetEntryRank(node, a) - widgetEntryRank(node, b)
    )
  }
  return serializableWidgets(node).map((widget, index) => [
    widget.name,
    widgets[index]
  ])
}

/**
 * Whether the changed-name set covers this document key, either directly or
 * through the live widget an overflow alias resolves to (rejected-op name sets
 * carry the widget's real name).
 */
function changed(
  node: LGraphNode,
  name: string,
  names: ReadonlySet<string>
): boolean {
  if (names.has(name)) return true
  const positional = overflowWidget(node, name)
  return positional !== undefined && names.has(positional.name)
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

/** Writes a widget value and its mirrored node property; returns the undo. */
function writeWidgetValue(
  node: LGraphNode,
  widget: IBaseWidget,
  value: WidgetValue
): () => void {
  const previous = widget.value
  const property = widget.options.property
  if (!property || node.properties[property] === undefined) {
    widget.value = value
    return () => {
      widget.value = previous
    }
  }
  const previousProperty = node.properties[property]
  widget.value = value
  node.setProperty(property, value)
  return () => {
    widget.value = previous
    node.setProperty(property, previousProperty)
  }
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
