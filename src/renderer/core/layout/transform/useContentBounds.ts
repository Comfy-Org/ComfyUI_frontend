import { reactive, readonly } from 'vue'

import type { Bounds, NodeLayout, Point } from '@/renderer/core/layout/types'

/**
 * Margin added around tracked content bounds to avoid frequent resizing
 * when nodes move slightly beyond the current tracked area.
 */
const EXPAND_MARGIN = 2000

interface ContentBoundsState {
  /** Offset to add to node positions so all content lands in positive space */
  offset: Readonly<Point>
  /** Total size of the content area after offset adjustment */
  size: Readonly<{ width: number; height: number }>
}

/**
 * Tracks the bounding box of all canvas content and computes an offset
 * that shifts all positions into positive coordinate space.
 *
 * This enables the TransformPane's CSS box to fully contain all child
 * nodes, preventing Chrome's compositor from creating individual
 * compositing layers for overflowing children.
 *
 * Uses a grow-only strategy: bounds expand when content moves beyond
 * the tracked area but never shrink automatically. Call `reset()` to
 * recalculate from scratch (e.g., on workflow load).
 */
export function useContentBounds(): ContentBoundsState & {
  expandToInclude(bounds: Bounds): void
  update(nodes: ReadonlyMap<string, NodeLayout>, version: number): void
  flush(): boolean
  reset(): void
} {
  const offset = reactive<Point>({ x: 0, y: 0 })
  const size = reactive({ width: 0, height: 0 })

  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0
  let dirty = false

  function expandToInclude(bounds: Bounds) {
    const bRight = bounds.x + bounds.width
    const bBottom = bounds.y + bounds.height

    // Only expand when content actually exceeds the tracked area.
    // When expanding, add EXPAND_MARGIN as headroom to avoid frequent resizing.
    if (bounds.x < minX) {
      minX = bounds.x - EXPAND_MARGIN
      dirty = true
    }
    if (bounds.y < minY) {
      minY = bounds.y - EXPAND_MARGIN
      dirty = true
    }
    if (bRight > maxX) {
      maxX = bRight + EXPAND_MARGIN
      dirty = true
    }
    if (bBottom > maxY) {
      maxY = bBottom + EXPAND_MARGIN
      dirty = true
    }
  }

  let lastTrackedVersion = -1
  let sampleNodeId: string | null = null

  /**
   * Update bounds from the current set of node layouts, skipping work
   * when the version hasn't changed. Detects workflow switches by
   * checking whether a previously sampled node still exists — when
   * the entire node set is replaced, resets bounds to prevent
   * unbounded growth across unrelated workflows.
   */
  function update(
    nodes: ReadonlyMap<string, NodeLayout>,
    version: number
  ) {
    if (version === lastTrackedVersion) return
    lastTrackedVersion = version

    if (sampleNodeId !== null && nodes.size > 0 && !nodes.has(sampleNodeId)) {
      reset()
    }
    sampleNodeId = nodes.size > 0 ? (nodes.keys().next().value ?? null) : null

    for (const [, layout] of nodes) {
      expandToInclude(layout.bounds)
    }
  }

  /**
   * Applies pending bound changes to the reactive offset and size.
   * Returns true if the values actually changed.
   */
  function flush(): boolean {
    if (!dirty) return false
    dirty = false
    offset.x = -minX || 0
    offset.y = -minY || 0
    size.width = maxX - minX || 0
    size.height = maxY - minY || 0
    return true
  }

  function reset() {
    minX = 0
    minY = 0
    maxX = 0
    maxY = 0
    dirty = false
    offset.x = 0
    offset.y = 0
    size.width = 0
    size.height = 0
  }

  return {
    offset: readonly(offset),
    size: readonly(size),
    expandToInclude,
    update,
    flush,
    reset
  }
}
