import { ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { NodeProgressState } from '@/schemas/apiSchema'
import { useExecutionStore } from '@/stores/executionStore'

import type { UpdateFlags } from '../types'

function quantise(value: number): number {
  return Math.round(value * 8)
}

function mixIn(digest: number, value: number): number {
  return (Math.imul(digest, 31) + (Number.isFinite(value) ? value : 0)) | 0
}

function hashString(value: string): number {
  let hash = value.length
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0
  }
  return hash
}

interface MinimapDigests {
  geometry: number
  visual: number
  connections: number
}

/**
 * Digests every value rendered by the minimap without allocating per-node
 * cache entries. Geometry is separate because only it invalidates bounds.
 */
function computeMinimapDigests(
  graph: LGraph,
  nodeGeometryVersion: number,
  progressStates: Readonly<Record<string, NodeProgressState>>
): MinimapDigests {
  // The renderer prefers LayoutStore geometry, which can update before the
  // corresponding LiteGraph node. The geometry-only version closes that gap
  // without repainting for unrelated store operations such as z-index changes.
  let geometry = mixIn(nodeGeometryVersion, graph._nodes.length)
  let visual = 0

  for (const node of graph._nodes) {
    const [x, y] = node.pos
    const [width, height] = node.size
    geometry = mixIn(geometry, quantise(x))
    geometry = mixIn(geometry, quantise(y))
    geometry = mixIn(geometry, quantise(width))
    geometry = mixIn(geometry, quantise(height))
    visual = mixIn(visual, node.mode ?? 0)
    visual = mixIn(visual, node.has_errors ? 1 : 0)
    visual = mixIn(visual, node.bgcolor ? hashString(node.bgcolor) : 0)
  }

  for (const group of graph._groups ?? []) {
    visual = mixIn(visual, quantise(group.pos[0]))
    visual = mixIn(visual, quantise(group.pos[1]))
    visual = mixIn(visual, quantise(group.size[0]))
    visual = mixIn(visual, quantise(group.size[1]))
    visual = mixIn(visual, group.color ? hashString(group.color) : 0)
  }

  for (const nodeId in progressStates) {
    const state = progressStates[nodeId]?.state
    if (!state) continue
    visual = mixIn(visual, hashString(nodeId))
    visual = mixIn(visual, hashString(state))
  }

  const links = graph.links
  let connections = 0
  if (links) {
    for (const link of links.values()) {
      if (!link) continue
      connections = mixIn(connections, hashString(link.origin_id))
      connections = mixIn(connections, hashString(link.target_id))
      connections = mixIn(connections, link.origin_slot)
      connections = mixIn(connections, link.target_slot)
    }
  }

  return { geometry, visual, connections }
}

/**
 * Tracks the graph state relevant to minimap rendering. Call `checkForChanges`
 * from the owner's scheduler and `reset` when switching graphs.
 */
export function useMinimapGraph(graph: Ref<LGraph | null>) {
  const executionStore = useExecutionStore()
  let previousDigests: MinimapDigests | null = null
  const updateFlags = ref<UpdateFlags>({
    bounds: false,
    nodes: false,
    connections: false,
    viewport: false
  })

  const checkForChanges = () => {
    const g = graph.value
    if (!g) return false

    const currentDigests = computeMinimapDigests(
      g,
      layoutStore.nodeGeometryVersion,
      executionStore.nodeProgressStates
    )
    const geometryChanged =
      currentDigests.geometry !== previousDigests?.geometry
    const visualChanged = currentDigests.visual !== previousDigests?.visual
    const connectionChanged =
      currentDigests.connections !== previousDigests?.connections
    previousDigests = currentDigests

    if (geometryChanged) {
      updateFlags.value.bounds = true
    }
    if (geometryChanged || visualChanged) {
      updateFlags.value.nodes = true
    }
    if (connectionChanged) {
      updateFlags.value.connections = true
    }

    return geometryChanged || visualChanged || connectionChanged
  }

  const reset = () => {
    previousDigests = null
  }

  return {
    updateFlags,
    checkForChanges,
    reset
  }
}
