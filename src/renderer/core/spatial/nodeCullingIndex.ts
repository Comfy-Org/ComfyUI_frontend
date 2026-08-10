/**
 * Spatial index for viewport culling.
 *
 * Holds a QuadTree of node bounds that is rebuilt only when the supplied
 * version changes, so panning over a static graph costs a tree query rather
 * than a full rescan of every node.
 */
import type { Bounds, NodeId } from '@/renderer/core/layout/types'

import { QuadTree } from './QuadTree'

/** Slack around the graph extent so nodes on the edge insert cleanly. */
const ROOT_PADDING = 1000

const QUAD_TREE_OPTIONS = {
  maxDepth: 8,
  maxItemsPerNode: 8
} as const

export interface CullingIndexEntry {
  id: NodeId
  /** Null while a node has no layout yet. */
  bounds: Bounds | null
}

interface NodeCullingIndexOptions {
  /**
   * Changes whenever any node's position or size changes. Entries must be
   * derived from the same source as this version, or the index can cache
   * stale bounds indefinitely.
   */
  getVersion: () => number
  getEntries: () => Iterable<CullingIndexEntry>
}

export function createNodeCullingIndex({
  getVersion,
  getEntries
}: NodeCullingIndexOptions) {
  let tree: QuadTree<NodeId> | null = null
  let builtVersion: number | null = null
  let built = false

  /** Nodes with no bounds yet; they cannot be indexed, so always report them. */
  let unpositioned: NodeId[] = []

  function rebuild(): void {
    const positioned: CullingIndexEntry[] = []
    const pending: NodeId[] = []

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const entry of getEntries()) {
      const { bounds } = entry
      if (!bounds) {
        pending.push(entry.id)
        continue
      }
      positioned.push(entry)
      if (bounds.x < minX) minX = bounds.x
      if (bounds.y < minY) minY = bounds.y
      if (bounds.x + bounds.width > maxX) maxX = bounds.x + bounds.width
      if (bounds.y + bounds.height > maxY) maxY = bounds.y + bounds.height
    }

    unpositioned = pending

    if (positioned.length === 0) {
      tree = null
      return
    }

    // Size the root to the graph's own extent. QuadTree.insert drops anything
    // not fully contained, and the shared QUADTREE_CONFIG bounds are a fixed
    // +/-10000 box that real graphs outgrow.
    const root: Bounds = {
      x: minX - ROOT_PADDING,
      y: minY - ROOT_PADDING,
      width: maxX - minX + ROOT_PADDING * 2,
      height: maxY - minY + ROOT_PADDING * 2
    }

    tree = new QuadTree<NodeId>(root, QUAD_TREE_OPTIONS)
    for (const { id, bounds } of positioned) {
      tree.insert(String(id), bounds!, id)
    }
  }

  function ensureFresh(): void {
    const version = getVersion()
    if (built && builtVersion === version) return
    rebuild()
    builtVersion = version
    built = true
  }

  return {
    query(bounds: Bounds): NodeId[] {
      ensureFresh()
      const matches = tree ? tree.query(bounds) : []
      return unpositioned.length ? matches.concat(unpositioned) : matches
    },

    /** Forces a rebuild on next query, for changes the version does not cover. */
    invalidate(): void {
      built = false
    },

    get size(): number {
      ensureFresh()
      return (tree?.size ?? 0) + unpositioned.length
    }
  }
}
