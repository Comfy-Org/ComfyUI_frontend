import type { LGraphNode } from '../LGraphNode'
import type { LLink } from '../LLink'
import type { NewNodePosition } from '../interfaces'

interface LayeredGraphLayoutOptions {
  margin: number
  titleHeight: number
  vertical: boolean
}

interface GraphTopology {
  predecessors: Map<LGraphNode['id'], LGraphNode[]>
  successors: Map<LGraphNode['id'], LGraphNode[]>
  edges: GraphEdge[]
}

interface GraphEdge {
  origin: LGraphNode
  target: LGraphNode
  originLayer: number
  targetLayer: number
}

interface LayerBoundarySegment {
  startOrder: number
  endOrder: number
}

function buildTopology(
  nodes: readonly LGraphNode[],
  links: Iterable<LLink>,
  layerByNode: ReadonlyMap<LGraphNode['id'], number>
): GraphTopology {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const predecessors = new Map(
    nodes.map((node) => [node.id, [] as LGraphNode[]])
  )
  const successors = new Map(nodes.map((node) => [node.id, [] as LGraphNode[]]))
  const edges: GraphEdge[] = []

  for (const link of links) {
    const origin = nodeById.get(link.origin_id)
    const target = nodeById.get(link.target_id)
    if (!origin || !target) continue
    const originLayer = layerByNode.get(origin.id) ?? 1
    const targetLayer = layerByNode.get(target.id) ?? 1
    if (originLayer >= targetLayer) continue
    predecessors.get(target.id)?.push(origin)
    successors.get(origin.id)?.push(target)
    edges.push({ origin, target, originLayer, targetLayer })
  }

  return { predecessors, successors, edges }
}

function barycenter(
  nodes: readonly LGraphNode[],
  order: ReadonlyMap<LGraphNode['id'], number>
): number {
  let sum = 0
  let count = 0
  for (const node of nodes) {
    const position = order.get(node.id)
    if (position === undefined) continue
    sum += position
    count++
  }
  return count === 0 ? Number.POSITIVE_INFINITY : sum / count
}

function reorderLayer(
  nodes: LGraphNode[],
  adjacent: (node: LGraphNode) => readonly LGraphNode[],
  order: ReadonlyMap<LGraphNode['id'], number>
): void {
  const entries = nodes.map((node, index) => ({
    adjacent: adjacent(node),
    node,
    previousOrder: index
  }))
  const connected = entries.filter(({ adjacent }) => adjacent.length > 0)
  connected.sort((left, right) => {
    const leftCenter = barycenter(left.adjacent, order)
    const rightCenter = barycenter(right.adjacent, order)
    if (leftCenter !== rightCenter) return leftCenter - rightCenter
    return left.previousOrder - right.previousOrder
  })

  let connectedIndex = 0
  for (const [index, entry] of entries.entries()) {
    // A node with no neighbours in this sweep has no evidence-based position.
    // Keep its slot instead of pushing notes and incomplete branches aside.
    if (entry.adjacent.length === 0) continue
    nodes[index] = connected[connectedIndex++].node
  }
}

function addToFenwick(tree: number[], index: number): void {
  for (let cursor = index + 1; cursor < tree.length; cursor += cursor & -cursor)
    tree[cursor]++
}

function queryFenwick(tree: readonly number[], index: number): number {
  let total = 0
  for (let cursor = index + 1; cursor > 0; cursor -= cursor & -cursor)
    total += tree[cursor] ?? 0
  return total
}

function crossingCount(
  edges: readonly GraphEdge[],
  order: ReadonlyMap<LGraphNode['id'], number>
): number {
  const segmentsByBoundary = new Map<number, LayerBoundarySegment[]>()
  for (const edge of edges) {
    const originOrder = order.get(edge.origin.id) ?? 0
    const targetOrder = order.get(edge.target.id) ?? 0
    const layerSpan = edge.targetLayer - edge.originLayer
    // Split skip links into virtual straight segments so links with different
    // spans still share a crossing score at each layer boundary.
    for (
      let boundary = edge.originLayer;
      boundary < edge.targetLayer;
      boundary++
    ) {
      const startProgress = (boundary - edge.originLayer) / layerSpan
      const endProgress = (boundary + 1 - edge.originLayer) / layerSpan
      const segment = {
        startOrder: originOrder + startProgress * (targetOrder - originOrder),
        endOrder: originOrder + endProgress * (targetOrder - originOrder)
      }
      const segments = segmentsByBoundary.get(boundary)
      if (segments) segments.push(segment)
      else segmentsByBoundary.set(boundary, [segment])
    }
  }

  let crossings = 0
  for (const segments of segmentsByBoundary.values()) {
    segments.sort(
      (left, right) =>
        left.startOrder - right.startOrder || left.endOrder - right.endOrder
    )
    const orderedEnds = [
      ...new Set(segments.map(({ endOrder }) => endOrder))
    ].sort((left, right) => left - right)
    const endRank = new Map(orderedEnds.map((value, index) => [value, index]))
    const tree = new Array<number>(orderedEnds.length + 1).fill(0)
    let processed = 0
    for (let start = 0; start < segments.length;) {
      const startOrder = segments[start].startOrder
      let end = start
      // Query equal starts as one batch, and use an inclusive end sum, so
      // fan-out and fan-in links do not count as crossing each other.
      while (end < segments.length && segments[end].startOrder === startOrder) {
        const targetRank = endRank.get(segments[end].endOrder) ?? 0
        crossings += processed - queryFenwick(tree, targetRank)
        end++
      }
      for (let index = start; index < end; index++)
        addToFenwick(tree, endRank.get(segments[index].endOrder) ?? 0)
      processed += end - start
      start = end
    }
  }
  return crossings
}

function reduceCrossings(
  layers: Map<number, LGraphNode[]>,
  layerNumbers: readonly number[],
  topology: GraphTopology
): void {
  const order = new Map<LGraphNode['id'], number>()
  const refreshLayerOrder = (layer: number) => {
    layers.get(layer)?.forEach((node, index) => order.set(node.id, index))
  }
  for (const layer of layerNumbers) refreshLayerOrder(layer)

  // A sweep is a heuristic, so retain only strict improvements. This keeps an
  // already crossing-free workflow in its original execution order.
  let bestCrossingCount = crossingCount(topology.edges, order)
  let bestLayers = new Map(
    [...layers].map(([layer, nodes]) => [layer, [...nodes]])
  )
  const retainImprovement = () => {
    const currentCrossingCount = crossingCount(topology.edges, order)
    if (currentCrossingCount >= bestCrossingCount) return
    bestCrossingCount = currentCrossingCount
    bestLayers = new Map(
      [...layers].map(([layer, nodes]) => [layer, [...nodes]])
    )
  }

  for (let sweep = 0; sweep < 4; sweep++) {
    for (const layer of layerNumbers.slice(1)) {
      reorderLayer(
        layers.get(layer) ?? [],
        (node) => topology.predecessors.get(node.id) ?? [],
        order
      )
      refreshLayerOrder(layer)
    }
    retainImprovement()

    for (const layer of [...layerNumbers].reverse().slice(1)) {
      reorderLayer(
        layers.get(layer) ?? [],
        (node) => topology.successors.get(node.id) ?? [],
        order
      )
      refreshLayerOrder(layer)
    }
    retainImprovement()
  }

  for (const [layer, nodes] of bestLayers) layers.set(layer, nodes)
}

export function computeLayeredGraphLayout(
  nodes: readonly LGraphNode[],
  links: Iterable<LLink>,
  { margin, titleHeight, vertical }: LayeredGraphLayoutOptions
): NewNodePosition[] {
  const layerByNode = new Map(nodes.map((node) => [node.id, node._level || 1]))
  const layers = new Map<number, LGraphNode[]>()
  for (const node of nodes) {
    const layer = layerByNode.get(node.id) ?? 1
    const layerNodes = layers.get(layer)
    if (layerNodes) layerNodes.push(node)
    else layers.set(layer, [node])
  }

  const layerNumbers = [...layers.keys()].sort((left, right) => left - right)
  reduceCrossings(
    layers,
    layerNumbers,
    buildTopology(nodes, links, layerByNode)
  )

  const positions: NewNodePosition[] = []
  let primary = margin
  for (const layer of layerNumbers) {
    const layerNodes = layers.get(layer) ?? []
    let maxPrimarySize = 100
    let secondary = margin + titleHeight
    for (const node of layerNodes) {
      positions.push({
        node,
        newPos: vertical
          ? { x: secondary, y: primary }
          : { x: primary, y: secondary }
      })
      maxPrimarySize = Math.max(maxPrimarySize, node.size[vertical ? 1 : 0])
      secondary += node.size[vertical ? 0 : 1] + margin + titleHeight
    }
    primary += maxPrimarySize + margin
  }

  return positions
}
