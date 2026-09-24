import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

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
import { isUuidShapedSubgraphId } from '@/schemas/subgraphIdSchema'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
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
import type { PendingLocalEdits } from './pendingLocalEdits'
import { NO_PENDING_LOCAL_EDITS, widgetKey } from './pendingLocalEdits'

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
}

export interface ApplyResult {
  createdNodeIds: NodeId[]
}

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

function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
}

/**
 * `flags.ghost` marks a node the user is still placing; the snapshot minted
 * while placement is live carries it, but the flag is local interaction
 * state, never document state.
 */
function syncedFlags(flags: unknown): INodeFlags {
  if (typeof flags !== 'object' || flags === null) return {}
  const { ghost: _ghost, ...rest } = flags as INodeFlags
  return rest
}

function readDocNode(doc: Y.Doc, id: string): DocNode | null {
  const source = nodesMap(doc).get(id)
  if (!(source instanceof Y.Map)) return null
  const type = source.get('type')
  if (typeof type !== 'string' || type.length === 0) return null

  const fields: Record<string, unknown> = {}
  let widgets: DocNode['widgets']
  source.forEach((value, key) => {
    if (key === 'widgets' && value instanceof Y.Map) {
      widgets = value.toJSON()
    } else if (key === OPAQUE_WIDGETS_KEY) {
      const opaque = plain(value)
      if (Array.isArray(opaque)) widgets = opaque
    } else {
      fields[key] = plain(value)
    }
  })
  const serialised = {
    ...fields,
    id,
    type,
    pos: Array.isArray(fields.pos) ? fields.pos : [0, 0],
    size: Array.isArray(fields.size) ? fields.size : [0, 0],
    flags: syncedFlags(fields.flags),
    order: typeof fields.order === 'number' ? fields.order : 0,
    mode: typeof fields.mode === 'number' ? fields.mode : 0
  } as ISerialisedNode
  return { id, type, serialised, widgets }
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

function readDocSlotName(
  doc: Y.Doc,
  nodeId: string,
  kind: 'inputs' | 'outputs',
  slot: number
): string | undefined {
  const slots = nodesMap(doc).get(nodeId)?.get(kind)
  const list: unknown = slots instanceof Y.Array ? slots.toJSON() : slots
  if (!Array.isArray(list)) return undefined
  const entry: unknown = list[slot]
  const name =
    typeof entry === 'object' && entry !== null && 'name' in entry
      ? entry.name
      : undefined
  return typeof name === 'string' ? name : undefined
}

function docLinksIncident(doc: Y.Doc, nodeId: string): DocLink[] {
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

export class LiveGraphApplier {
  readonly #deps: LiveGraphApplierDeps
  readonly #reported = new Set<string>()

  constructor(deps: LiveGraphApplierDeps) {
    this.#deps = deps
  }

  /** Applies the collected changes of one delivered frame to the live graph. */
  applyChanges(
    doc: Y.Doc,
    changes: FrameChanges,
    context: RemoteApplyContext
  ): ApplyResult {
    const graph = this.#deps.getGraph()
    if (!graph) return { createdNodeIds: [] }
    return this.#write(graph, context, () => {
      const created: NodeId[] = []
      const touchedNodes = new Set<string>()
      this.#registerDefinitions(graph, doc)

      for (const [id, change] of changes.nodes) {
        if (change === 'delete') {
          this.#try(context, () => this.#deleteNode(graph, id))
          continue
        }
        touchedNodes.add(id)
        this.#try(context, () => {
          const result = this.#upsertNode(graph, doc, id)
          if (result === 'created') created.push(toNodeId(id))
          if (result === 'recreated') {
            for (const link of docLinksIncident(doc, id)) {
              this.#connectLink(graph, doc, link)
            }
          }
        })
      }

      for (const id of changes.resyncNodes) {
        if (touchedNodes.has(id)) continue
        this.#try(context, () => this.#syncFields(graph, doc, id))
      }

      for (const [id, names] of changes.widgets) {
        if (touchedNodes.has(id)) continue
        this.#try(context, () => this.#syncWidgets(graph, doc, id, names))
      }

      this.#applyLinks(graph, doc, [...changes.links], context)
      this.#placeBatch(graph, created)
      return { createdNodeIds: created }
    })
  }

  /**
   * Makes the live graph agree with the whole document: every document node
   * and link is created or updated, and every live node or link the document
   * lacks is removed. The local human's `pending` edits are the one exception
   * in both directions, so the pass can neither resurrect a node whose delete
   * is still in flight nor drop a node, link, or widget value whose op is.
   */
  syncFromDoc(
    doc: Y.Doc,
    context: RemoteApplyContext,
    pending: PendingLocalEdits = NO_PENDING_LOCAL_EDITS
  ): ApplyResult {
    const graph = this.#deps.getGraph()
    if (!graph) return { createdNodeIds: [] }
    return this.#write(graph, context, () => {
      const created: NodeId[] = []
      this.#registerDefinitions(graph, doc)
      this.#removeAbsentNodes(graph, doc, pending, context)
      nodesMap(doc).forEach((_, id) => {
        if (pending.deletedNodeIds.has(id)) return
        this.#try(context, () => {
          if (
            this.#upsertNode(graph, doc, id, pending.widgetKeys) === 'created'
          )
            created.push(toNodeId(id))
        })
      })
      this.#removeAbsentLinks(graph, doc, pending, context)
      const linkKeys = [...linksMap(doc).keys()].filter((key) => {
        const link = readDocLink(doc, key)
        return (
          !link ||
          (!pending.deletedNodeIds.has(link.origin) &&
            !pending.deletedNodeIds.has(link.target) &&
            !pending.linkIds.has(link.id))
        )
      })
      this.#applyLinks(graph, doc, linkKeys, context)
      this.#placeBatch(graph, created)
      return { createdNodeIds: created }
    })
  }

  #removeAbsentNodes(
    graph: LGraph,
    doc: Y.Doc,
    pending: PendingLocalEdits,
    context: RemoteApplyContext
  ): void {
    const docNodes = nodesMap(doc)
    const absent = graph._nodes.filter((node) => {
      const id = String(node.id)
      return !docNodes.has(id) && !pending.addedNodeIds.has(id)
    })
    for (const node of absent) this.#try(context, () => graph.remove(node))
  }

  #removeAbsentLinks(
    graph: LGraph,
    doc: Y.Doc,
    pending: PendingLocalEdits,
    context: RemoteApplyContext
  ): void {
    const docLinks = linksMap(doc)
    const absent = Array.from(graph.links.values()).filter(
      (link) =>
        !docLinks.has(String(link.id)) &&
        !pending.linkIds.has(link.id) &&
        !pending.addedNodeIds.has(String(link.origin_id)) &&
        !pending.addedNodeIds.has(String(link.target_id))
    )
    for (const link of absent)
      this.#try(context, () => graph.removeLink(link.id))
  }

  /** Empties the live graph, as a document reset replaces everything. */
  clear(context: RemoteApplyContext): void {
    const graph = this.#deps.getGraph()
    if (!graph) return
    this.#write(graph, context, () => graph.clear())
  }

  /**
   * One frame is one change: the same `before-change`/`after-change` bracket
   * a multi-step human edit emits, so the change tracker records a single
   * undo entry and flips `isModified` once.
   */
  #write<T>(graph: LGraph, context: RemoteApplyContext, fn: () => T): T {
    const withActor = this.#deps.withRemoteActor ?? ((_, run) => run())
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

  #try(context: RemoteApplyContext, fn: () => void): void {
    try {
      fn()
    } catch (error) {
      reportError(error, {
        errorType: 'agent_graph_apply_failed',
        tags: { ...AGENT_APPLY_TAGS, outcome: 'degraded' },
        context: { actor: context.actor, opIds: [...context.opIds] }
      })
    }
  }

  #reportOnce(
    key: string,
    message: string,
    errorType: string,
    context: Record<string, unknown>
  ): void {
    if (this.#reported.has(key)) return
    this.#reported.add(key)
    reportError(new Error(message), {
      errorType,
      tags: { ...AGENT_APPLY_TAGS, outcome: 'degraded' },
      context
    })
  }

  #registerDefinitions(graph: LGraph, doc: Y.Doc): void {
    const rootGraph = graph.rootGraph
    const missing = allSubgraphDefinitions(readSubgraphDefinitions(doc))
      .map((definition) => ({ ...definition, definitions: undefined }))
      .filter((definition) => !rootGraph.subgraphs.has(definition.id))
    for (const definition of topologicalSortSubgraphs(missing)) {
      const failure = tryCreateSubgraph(rootGraph, definition)
      if (failure === undefined) {
        this.#reported.delete(`definition:${definition.id}`)
        continue
      }
      if (this.#reported.has(`definition:${definition.id}`)) continue
      this.#reported.add(`definition:${definition.id}`)
      reportError(failure, {
        errorType: 'agent_subgraph_definitions_failed',
        tags: { ...AGENT_APPLY_TAGS, outcome: 'degraded' },
        context: { graphId: graph.id, definitionId: definition.id }
      })
    }
  }

  #deleteNode(graph: LGraph, id: string): void {
    const node = graph.getNodeById(toNodeId(id))
    if (node) graph.remove(node)
  }

  #upsertNode(
    graph: LGraph,
    doc: Y.Doc,
    id: string,
    pendingWidgetKeys: ReadonlySet<string> = new Set()
  ): 'created' | 'recreated' | 'updated' | 'skipped' {
    const docNode = readDocNode(doc, id)
    if (!docNode) return 'skipped'
    const live = graph.getNodeById(toNodeId(id))
    if (live && live.type === docNode.type) {
      this.#applyFields(live, docNode)
      this.#applyWidgets(live, docNode.widgets, pendingWidgetKeys)
      return 'updated'
    }
    if (live) graph.remove(live)
    this.#createNode(graph, docNode)
    return live ? 'recreated' : 'created'
  }

  #createNode(graph: LGraph, docNode: DocNode): LGraphNode {
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
      this.#reportOnce(
        `node-id:${docNode.id}`,
        `Live graph reminted node ${docNode.id} as ${String(node.id)}`,
        'agent_graph_node_id_reminted',
        { nodeId: docNode.id, liveId: node.id }
      )
    }
    if (node.has_errors) {
      node.last_serialization = info
      node.configure(info)
      return node
    }
    node.configure({
      ...info,
      widgets_values: positionalWidgetValues(node, docNode.widgets)
    })
    return node
  }

  #applyFields(node: LGraphNode, docNode: DocNode): void {
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

  #syncFields(graph: LGraph, doc: Y.Doc, id: string): void {
    const docNode = readDocNode(doc, id)
    const node = graph.getNodeById(toNodeId(id))
    if (!docNode || !node || node.type !== docNode.type) return
    this.#applyFields(node, docNode)
  }

  #syncWidgets(
    graph: LGraph,
    doc: Y.Doc,
    id: string,
    names: ReadonlySet<string> | 'all'
  ): void {
    const docNode = readDocNode(doc, id)
    const node = graph.getNodeById(toNodeId(id))
    if (!docNode || !node || node.type !== docNode.type) return
    const widgets = docNode.widgets
    if (names === 'all' || Array.isArray(widgets)) {
      this.#applyWidgets(node, widgets)
      return
    }
    if (!widgets) return
    this.#applyWidgets(
      node,
      Object.fromEntries(
        Object.entries(widgets).filter(([name]) => names.has(name))
      )
    )
  }

  #applyWidgets(
    node: LGraphNode,
    widgets: DocNode['widgets'],
    pendingWidgetKeys: ReadonlySet<string> = new Set()
  ): void {
    if (widgets === undefined) return
    if (node.isSubgraphNode()) {
      this.#applyHostWidgets(node, widgets)
      return
    }
    const entries = Array.isArray(widgets)
      ? serializableWidgets(node).map((widget, index): [string, unknown] => [
          widget.name,
          widgets[index]
        ])
      : Object.entries(widgets)
    for (const [name, value] of entries) {
      if (value === undefined || !isWidgetValue(value)) continue
      if (pendingWidgetKeys.has(widgetKey(node.id, name))) continue
      const widget = node.widgets?.find((candidate) => candidate.name === name)
      if (!widget) {
        this.#reportOnce(
          `widget:${String(node.id)}:${name}`,
          `Node ${String(node.id)} (${node.type}) has no widget '${name}'`,
          'agent_graph_widget_missing',
          { nodeId: node.id, type: node.type, name }
        )
        continue
      }
      this.#setWidgetValue(node, widget, value)
    }
  }

  #applyHostWidgets(node: LGraphNode, widgets: DocNode['widgets']): void {
    const promoted = node.inputs.filter((input) => input.widgetId)
    if (Array.isArray(widgets) && widgets.length !== promoted.length) {
      this.#reportOnce(
        `host-widgets:${String(node.id)}:${widgets.length}`,
        `Subgraph host ${String(node.id)} carries ${widgets.length} opaque widget values for ${promoted.length} promoted widgets`,
        'agent_graph_host_widgets_mismatch',
        { nodeId: node.id, expected: promoted.length, actual: widgets.length }
      )
      return
    }
    const store = useWidgetValueStore()
    for (const [name, value] of hostWidgetEntries(promoted, widgets)) {
      if (!isWidgetValue(value)) continue
      const widgetId = promoted.find((input) => input.name === name)?.widgetId
      if (!widgetId) {
        this.#reportOnce(
          `widget:${String(node.id)}:${name}`,
          `Subgraph host ${String(node.id)} (${node.type}) promotes no widget '${name}'`,
          'agent_graph_widget_missing',
          { nodeId: node.id, type: node.type, name }
        )
        continue
      }
      store.setValue(widgetId, value)
    }
    node.graph?.incrementVersion()
  }

  #setWidgetValue(node: LGraphNode, widget: IBaseWidget, value: WidgetValue) {
    if (widget.type === 'button') return
    const previous = widget.value
    if (Object.is(previous, value)) return
    widget.value = value
    const property = widget.options.property
    if (property && node.properties[property] !== undefined)
      node.setProperty(property, value)
    const canvas = this.#deps.getCanvas?.() ?? undefined
    widget.callback?.(value, canvas, node)
    node.onWidgetChanged?.(widget.name, value, previous, widget)
    node.graph?.incrementVersion()
  }

  #applyLinks(
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
          this.#try(context, () => graph.removeLink(toLinkId(id)))
        continue
      }
      this.#try(context, () => {
        if (this.#connectLink(graph, doc, link) === 'unresolved')
          retry.push(link)
      })
    }
    for (const link of retry) {
      this.#try(context, () => {
        if (this.#connectLink(graph, doc, link) !== 'connected') {
          this.#reportOnce(
            `link:${link.id}`,
            `Link ${link.id} (node ${link.origin} slot ${link.originSlot} -> node ${link.target} slot ${link.targetSlot}) could not be connected on the live graph`,
            'agent_graph_link_unresolved',
            { ...link }
          )
        }
      })
    }
  }

  #connectLink(
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
      link.originSlot
    )
    const targetSlot = resolveSlot(
      target.inputs.map((input) => input.name),
      readDocSlotName(doc, link.target, 'inputs', link.targetSlot),
      link.targetSlot
    )
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

  #placeBatch(graph: LGraph, created: readonly NodeId[]): void {
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
      viewport: this.#deps.viewportBounds?.() ?? null,
      incoming: incoming.map(rect)
    })
    if (!offset) return
    for (const node of incoming) {
      node.pos = [node.pos[0] + offset.dx, node.pos[1] + offset.dy]
    }
  }
}

/**
 * Resolves a document slot to a live slot index: by name when the document
 * names the slot (a name the live node lacks is a real mismatch, never a
 * positional guess), otherwise by position when that position exists live.
 */
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

/** Host widget values by promoted-input name; a positional list is read in promoted-input order. */
function hostWidgetEntries(
  promoted: readonly INodeInputSlot[],
  widgets: DocNode['widgets']
): [string, unknown][] {
  if (Array.isArray(widgets))
    return promoted.map((input, index) => [input.name, widgets[index]])
  return Object.entries(widgets ?? {})
}

function applyAppearance(node: LGraphNode, source: ISerialisedNode): void {
  for (const key of SYNCED_APPEARANCE_FIELDS) {
    const value = source[key]
    if (value !== undefined && node[key] !== value) {
      Object.assign(node, { [key]: value })
    }
  }
}

function resolveSlot(
  liveNames: readonly string[],
  docName: string | undefined,
  docIndex: number
): number {
  if (docName !== undefined) return liveNames.indexOf(docName)
  return docIndex < liveNames.length ? docIndex : -1
}

function tryCreateSubgraph(
  rootGraph: LGraph,
  definition: ExportedSubgraph
): unknown {
  if (!isUuidShapedSubgraphId(definition.id)) {
    return new Error(
      `Agent subgraph definition id is not a UUID: ${definition.id}`
    )
  }
  try {
    withNamedValuesRestore(() => rootGraph.createSubgraph(definition))
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
