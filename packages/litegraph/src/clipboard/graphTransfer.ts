import { cloneDeep } from 'es-toolkit/compat'
import type {
  LGraph,
  LGraphCanvas,
  Subgraph,
  SubgraphId
} from '@comfyorg/graph-model/entityRegistry'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import { parseNodeId, serializeNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId, SerializedNodeId } from '@comfyorg/graph-model/nodeId'
import { toRerouteId } from '@comfyorg/graph-model/rerouteId'
import type { RerouteId } from '@comfyorg/graph-model/rerouteId'
import type {
  ClipboardItems,
  ISerialisedNode
} from '@comfyorg/graph-model/serialisation'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { LGraphGroup } from '#/LGraphGroup'
import { LGraphNode } from '#/LGraphNode'
import type { LLink } from '#/LLink'
import { Reroute } from '#/Reroute'
import { NullGraphError } from '#/infrastructure/NullGraphError'
import { detachSerialisedLinks } from '#/linkDeduplication'
import { LiteGraph } from '#/litegraphInstance'
import { SubgraphNode } from '#/subgraph/SubgraphNode'
import { useLayoutMutations } from '@comfyorg/graph-state/layout/layoutMutations'
import { layoutStore } from '@comfyorg/graph-state/layout/layoutStore'
import { LayoutSource } from '@comfyorg/graph-state/layout/types'
import { useLinkPresentationStore } from '@comfyorg/graph-state/linkPresentationStore'
import { forEachNode } from '#/utils/graphTraversalUtil'
import { createUuidv4 } from '@comfyorg/graph-model/uuid'
import { transferLinkPresentation } from '#/transferLinkPresentation'

export interface InsertResult {
  created: Positionable[]

  nodes: Map<SerializedNodeId, LGraphNode>

  links: Map<LinkId, LLink>

  reroutes: Map<RerouteId, Reroute>

  subgraphs: Map<SubgraphId, Subgraph>
}

type InitializedClipboardItems = {
  [Key in keyof ClipboardItems]-?: NonNullable<ClipboardItems[Key]>
}

interface ClipboardPasteContext {
  connectInputs: boolean
  dx: number
  dy: number
  graph: LGraph
  items: InitializedClipboardItems
  result: InsertResult
  targetSlotByLink: Map<LinkId, number>
}

export interface InsertOptions {
  connectInputs?: boolean

  position?: Point
}

export function serializeItems(
  canvas: LGraphCanvas,
  items?: Iterable<Positionable>
): ClipboardItems {
  const serialisable: Required<ClipboardItems> = {
    nodes: [],
    groups: [],
    reroutes: [],
    links: [],
    subgraphs: []
  }
  const subgraphs = new Set<Subgraph>()
  for (const item of items ?? canvas.selectedItems) {
    if (item instanceof LGraphNode) {
      if (item.clonable === false) continue

      const cloned = item.clone()?.serialize()
      if (!cloned) continue

      cloned.id = serializeNodeId(item.id)
      cloned.inputs = item
        .serialize()
        .inputs?.map((input) => ({ ...input, link: null }))
      serialisable.nodes.push(cloned)
      for (const { link: linkId } of item.inputs) {
        if (linkId == null) continue

        const graph = canvas.graph
        const link = graph?.links.get(linkId)
        if (!graph || !link) continue

        serialisable.links.push({
          ...link.asSerialisable(),
          ...useLinkPresentationStore().getPresentation(
            graphScopeOf(graph),
            linkId
          )
        })
      }
      if (item instanceof SubgraphNode) {
        subgraphs.add(item.subgraph)
      }
    } else if (item instanceof LGraphGroup) {
      serialisable.groups.push(item.serialize())
    } else if (item instanceof Reroute) {
      serialisable.reroutes.push(item.asSerialisable())
    }
  }
  for (const subgraph of subgraphs) {
    for (const node of subgraph.nodes) {
      if (node instanceof SubgraphNode) {
        subgraphs.add(node.subgraph)
      }
    }
    serialisable.subgraphs.push(structuredClone(subgraph.asSerialisable()))
  }
  return serialisable
}

export function insertItems(
  canvas: LGraphCanvas,

  clipboardItems: ClipboardItems,
  options: InsertOptions = {}
): InsertResult | undefined {
  const { connectInputs = false, position = canvas.graph_mouse } = options
  if (!LiteGraph.ctrl_shift_v_paste_connect_unselected_outputs && connectInputs)
    return

  const { graph } = canvas
  if (!graph) throw new NullGraphError()
  const previousSelection = [...canvas.selectedItems]
  graph.beforeChange()
  canvas.emitBeforeChange()

  let result: InsertResult | undefined
  let operationFailed = false
  let operationError: unknown
  try {
    const items = initializeClipboardItems(clipboardItems)
    const [offsetX, offsetY] = clipboardOffset(items)
    result = {
      created: [],
      links: new Map(),
      nodes: new Map(),
      reroutes: new Map(),
      subgraphs: new Map()
    }
    const context: ClipboardPasteContext = {
      connectInputs,
      dx: position[0] - offsetX,
      dy: position[1] - offsetY,
      graph,
      items,
      result,
      targetSlotByLink: new Map()
    }

    remapClipboardSubgraphIds(items)
    createClipboardSubgraphs(context)
    for (const info of items.groups) {
      info.id = -1
      const group = new LGraphGroup()
      group.configure(info)
      graph.add(group)
      result.created.push(group)
    }
    for (const info of items.nodes) {
      const node = LiteGraph.createNode(info.type)
      if (!node) continue

      result.nodes.set(serializeNodeId(info.id), node)
      info.id = -1
      const linkByInputName = detachSerialisedLinks(info)
      node.pos = [info.pos[0] + context.dx, info.pos[1] + context.dy]
      try {
        graph.add(node)
        result.created.push(node)
      } catch (error) {
        if (graph.nodes.includes(node)) result.created.push(node)
        throw error
      }
      node.configure(info)

      recordClipboardTargetSlots(
        info,
        linkByInputName,
        context.targetSlotByLink
      )
      configurePastedSubgraphNode(node, info)
    }
    createClipboardReroutes(context)
    for (const info of items.links) createClipboardLink(context, info)
    removeUnusedClipboardReroutes(context)
    positionClipboardItems(context)
    updateClipboardNodeLayout(context)

    canvas.selectItems(result.created)
    forEachNode(graph, (n) => n.onGraphConfigured?.())
    forEachNode(graph, (n) => n.onAfterGraphConfigured?.())
  } catch (error) {
    operationFailed = true
    operationError = error
    if (result) rollbackClipboardPaste(graph, result)
    if (canvas.graph === graph) canvas.selectItems(previousSelection)
  }

  const closingErrors: unknown[] = []
  try {
    graph.afterChange()
  } catch (error) {
    closingErrors.push(error)
    if (!operationFailed && result) {
      rollbackClipboardPaste(graph, result)
      if (canvas.graph === graph) canvas.selectItems(previousSelection)
    }
  }

  try {
    canvas.emitAfterChange()
  } catch (error) {
    closingErrors.push(error)
  }

  if (operationFailed && closingErrors.length) {
    const combinedError = new AggregateError(
      [operationError, ...closingErrors],
      'Clipboard paste and change finalization both failed'
    )
    combinedError.cause = operationError
    throw combinedError
  }
  if (operationFailed) throw operationError
  if (closingErrors.length === 1) throw closingErrors[0]
  if (closingErrors.length)
    throw new AggregateError(
      closingErrors,
      'Clipboard paste change finalization failed'
    )
  return result
}

function initializeClipboardItems(
  clipboardItems: ClipboardItems
): InitializedClipboardItems {
  const items = cloneDeep(clipboardItems)
  return {
    groups: items.groups ?? [],
    links: items.links ?? [],
    nodes: items.nodes ?? [],
    reroutes: items.reroutes ?? [],
    subgraphs: items.subgraphs ?? []
  }
}

function clipboardOffset(items: InitializedClipboardItems): Point {
  let x = Infinity
  let y = Infinity
  for (const item of [...items.nodes, ...items.reroutes]) {
    x = Math.min(x, item.pos[0])
    y = Math.min(y, item.pos[1])
  }
  for (const group of items.groups) {
    x = Math.min(x, group.bounding[0])
    y = Math.min(y, group.bounding[1])
  }
  return [x, y]
}

function rollbackClipboardPaste(graph: LGraph, result: InsertResult): void {
  for (const item of [...result.created].reverse()) {
    try {
      if (item instanceof LGraphNode || item instanceof LGraphGroup) {
        graph.remove(item, { force: true })
      } else if (item instanceof Reroute) {
        graph.removeReroute(item.id)
      }
    } catch (error) {
      reportError(error, {
        errorType: 'failure_rolling_back_clipboard_item',
        surface: 'graph'
      })
    }
  }

  const registeredSubgraphs = [...result.subgraphs.values()].filter(
    (subgraph) => graph.rootGraph.subgraphs.get(subgraph.id) === subgraph
  )
  try {
    graph.releaseSubgraphs(registeredSubgraphs)
  } catch (error) {
    reportError(error, {
      errorType: 'failure_rolling_back_clipboard_subgraphs',
      surface: 'graph'
    })
  }
}

function remapClipboardSubgraphIds(items: InitializedClipboardItems): void {
  const remappedIds = new Map<string, string>()
  for (const subgraph of items.subgraphs) {
    const nextId = createUuidv4()
    remappedIds.set(subgraph.id, nextId)
    subgraph.id = nextId
  }

  const allNodes = [
    ...items.nodes,
    ...items.subgraphs.flatMap((subgraph) => subgraph.nodes ?? [])
  ]
  for (const node of allNodes) {
    const nextType = remappedIds.get(node.type)
    if (nextType) node.type = nextType
  }
}

function createClipboardSubgraphs(context: ClipboardPasteContext): void {
  const { graph, items, result } = context
  for (const subgraph of graph.createSubgraphs(items.subgraphs, {
    nodeIds: items.nodes
      .map((node) => parseNodeId(node.id))
      .filter((id): id is NodeId => id !== null)
  })) {
    result.subgraphs.set(subgraph.id, subgraph)
  }
}

function recordClipboardTargetSlots(
  info: ISerialisedNode,
  linkByInputName: Map<string, LinkId>,
  targetSlotByLink: Map<LinkId, number>
): void {
  for (const [slot, input] of (info.inputs ?? []).entries()) {
    const linkId = linkByInputName.get(input.name)
    if (linkId != null && !targetSlotByLink.has(linkId)) {
      targetSlotByLink.set(linkId, slot)
    }
  }
}

function configurePastedSubgraphNode(
  node: LGraphNode,
  info: ISerialisedNode
): void {
  if (!(node instanceof SubgraphNode)) return

  const flushProxyWidgets = LiteGraph.LGraph.proxyWidgetMigrationFlush
  if (node.properties.proxyWidgets !== undefined && flushProxyWidgets) {
    flushProxyWidgets(node, info)
  }
  LiteGraph.LGraph.autoExposePreviewNodes?.(node)
}

function createClipboardReroutes(context: ClipboardPasteContext): void {
  const { graph, items, result } = context
  for (const info of items.reroutes) {
    const { id, ...rerouteInfo } = info
    const reroute = graph.setReroute(rerouteInfo)
    if (!reroute) continue
    result.created.push(reroute)
    result.reroutes.set(toRerouteId(id), reroute)
  }

  for (const reroute of result.reroutes.values()) {
    if (reroute.parentId == null) continue
    const parent = result.reroutes.get(reroute.parentId)
    if (parent) reroute.parentId = parent.id
  }
}

function createClipboardLink(
  context: ClipboardPasteContext,
  info: InitializedClipboardItems['links'][number]
): void {
  const { graph, result, targetSlotByLink } = context
  const targetNode = result.nodes.get(serializeNodeId(info.target_id))
  if (!targetNode) return

  const [originNode, afterRerouteId] = clipboardLinkOrigin(context, info)
  const link = originNode?.connect(
    info.origin_slot,
    targetNode,
    targetSlotByLink.get(toLinkId(info.id)) ?? info.target_slot,
    afterRerouteId
  )
  if (!link) return

  transferLinkPresentation(
    graphScopeOf(graph),
    {
      hidden: info.hidden === true,
      label: typeof info.label === 'string' ? info.label : undefined
    },
    link.id
  )
  result.links.set(toLinkId(info.id), link)
}

function clipboardLinkOrigin(
  context: ClipboardPasteContext,
  info: InitializedClipboardItems['links'][number]
): [LGraphNode | null | undefined, RerouteId | undefined] {
  const { connectInputs, graph, result } = context
  let originNode: LGraphNode | null | undefined = result.nodes.get(
    serializeNodeId(info.origin_id)
  )
  let afterRerouteId =
    info.parentId == null
      ? undefined
      : result.reroutes.get(toRerouteId(info.parentId))?.id

  if (
    connectInputs &&
    LiteGraph.ctrl_shift_v_paste_connect_unselected_outputs
  ) {
    const originNodeId = parseNodeId(info.origin_id)
    originNode ??= originNodeId ? graph.getNodeById(originNodeId) : null
    if (info.parentId !== undefined) {
      afterRerouteId ??= toRerouteId(info.parentId)
    }
  }

  return [originNode, afterRerouteId]
}

function removeUnusedClipboardReroutes(context: ClipboardPasteContext): void {
  const { graph, result } = context
  for (const [sourceId, reroute] of result.reroutes) {
    if (reroute.totalLinks !== 0) continue

    graph.removeReroute(reroute.id)
    result.reroutes.delete(sourceId)
    const index = result.created.indexOf(reroute)
    if (index !== -1) result.created.splice(index, 1)
  }
}

function positionClipboardItems(context: ClipboardPasteContext): void {
  const { dx, dy, result } = context
  for (const item of result.created) {
    if (item instanceof LGraphNode) {
      item.setPos(item.pos[0] + dx, item.pos[1] + dy)
    } else {
      item.move(dx, dy, true)
    }
  }
}

function updateClipboardNodeLayout(context: ClipboardPasteContext): void {
  const { graph, result } = context
  const positions = result.created
    .filter((item): item is LGraphNode => item instanceof LGraphNode)
    .map((node) => ({
      nodeId: node.id,
      bounds: {
        x: node.pos[0],
        y: node.pos[1],
        width: node.size[0],
        height: node.size[1]
      }
    }))

  const rootGraphId = graph.rootGraph.id
  layoutStore.batchUpdateNodeBounds(rootGraphId, positions, {
    source: LayoutSource.Canvas
  })
  const { setNodeZIndex } = useLayoutMutations(LayoutSource.Canvas)
  for (const { nodeId } of positions) {
    setNodeZIndex(rootGraphId, nodeId, layoutStore.allocateZIndex())
  }
}
