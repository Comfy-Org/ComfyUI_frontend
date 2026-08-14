/**
 * Viewport culling for Vue node components.
 *
 * Only nodes intersecting the expanded viewport are kept mounted in the DOM.
 * Nodes are mounted as soon as they enter, and unmounted after a short delay
 * once they leave, so nodes oscillating on the viewport edge during a pan do
 * not thrash mount/unmount.
 *
 * The mounted set has five inputs: camera, node-list membership, node bounds,
 * viewport size and the pinned set. Camera and membership have direct watchers;
 * the rest are covered by a slow interval that early-outs on a cheap
 * fingerprint, so a drag that moves bounds without touching the camera, a
 * selection change, or a canvas resize is picked up within one tick without
 * making any of them a reactive dependency of the node list.
 *
 * Mount/unmount culling has been removed from this codebase before (#5510 →
 * #5767 → #6209): the #6209 measurement compared against a variant whose
 * visibility pass did not execute and which only toggled `display`, so it does
 * not bear on this implementation — but the earlier removals are the honest
 * precedent that unmount-based culling has real interaction hazards. The
 * pinning and owner-scoped cleanup here exist because of them.
 */
import {
  tryOnScopeDispose,
  useDebounceFn,
  useEventListener,
  useIntervalFn,
  useThrottleFn
} from '@vueuse/core'
import { shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'

/** Extra coverage beyond each viewport edge, as a fraction of viewport size. */
const VIEWPORT_MARGIN_RATIO = 0.5

/**
 * Ceiling on the margin, in graph units.
 *
 * The ratio above is screen-relative, so dividing it by the zoom makes the
 * margin cover more and more of the graph as the user zooms out - at minimum
 * zoom it more than doubles the queried area, pulling in far more nodes than a
 * pan could reach before the next recompute. Roughly five node widths is ample
 * lead time at any zoom.
 */
const MAX_MARGIN_GRAPH_UNITS = 2000

/** Grace period before unmounting nodes that left the viewport. */
const UNMOUNT_DELAY_MS = 250

/** Minimum interval between visibility recomputations during pan/zoom. */
const RECOMPUTE_THROTTLE_MS = 100

/** Backstop interval for inputs with no direct watcher (bounds, selection, canvas size). */
const BACKSTOP_INTERVAL_MS = 250

/**
 * Extra mounted nodes tolerated before pruning eagerly, so small graphs are
 * not pruned on every recompute.
 */
const PRUNE_SLACK = 8

/**
 * Most component trees mounted in one refresh.
 *
 * A wheel zoom-out can bring the whole graph into the culling bounds at once;
 * mounting thousands of trees in one synchronous flush freezes the frame the
 * user is interacting in. Excess entries mount on immediately following
 * refreshes, so the full set still arrives, spread across a few frames.
 */
const MOUNT_BATCH_LIMIT = 250

interface Size {
  width: number
  height: number
}

interface Camera {
  x: number
  y: number
  z: number
}

/**
 * Expanded viewport rect in graph coordinates.
 *
 * Screen space maps to graph space as `graph = screen / z - offset`, matching
 * the transform applied by TransformPane.
 */
export function getCullingBounds(
  camera: Camera,
  viewport: Size,
  marginRatio = VIEWPORT_MARGIN_RATIO
): Bounds {
  const scale = camera.z || 1
  const marginX = Math.min(
    (viewport.width * marginRatio) / scale,
    MAX_MARGIN_GRAPH_UNITS
  )
  const marginY = Math.min(
    (viewport.height * marginRatio) / scale,
    MAX_MARGIN_GRAPH_UNITS
  )

  return {
    x: -marginX - camera.x,
    y: -marginY - camera.y,
    width: viewport.width / scale + marginX * 2,
    height: viewport.height / scale + marginY * 2
  }
}

interface UseViewportCullingOptions {
  nodes: ComputedRef<VueNodeData[]>
  /** Ids whose bounds intersect the given graph-space rect. */
  queryNodesInBounds: (bounds: Bounds) => Iterable<NodeId>
  getViewportSize: () => Size
  /**
   * Nodes that must not be unmounted while they are already mounted, so that
   * unmounting never interrupts an interaction in progress. Retention only: a
   * pinned node outside the viewport that is not mounted stays unmounted, so
   * select-all cannot mount the whole graph.
   */
  getPinnedIds?: () => ReadonlySet<NodeId> | undefined
}

export function useViewportCulling({
  nodes,
  queryNodesInBounds,
  getViewportSize,
  getPinnedIds
}: UseViewportCullingOptions) {
  const { camera } = useTransformState()
  const mountedNodeIds = shallowRef<Set<NodeId>>(new Set())

  // VueUse debounce/throttle timers use a bare setTimeout with no scope hook,
  // so a queued trailing callback outlives the component on workflow switch or
  // route change and would recompute against a torn-down canvas.
  let disposed = false

  function computeVisibleNodeIds(): Set<NodeId> {
    const visible = new Set<NodeId>()
    const viewport = getViewportSize()
    const mounted = mountedNodeIds.value

    // No measurable viewport (canvas absent, or hidden by App mode's
    // display:none). Nothing can be judged visible or hidden, so hold the
    // current set rather than defaulting open and mounting the whole graph.
    if (!viewport.width || !viewport.height) {
      return new Set(mounted)
    }

    for (const id of queryNodesInBounds(getCullingBounds(camera, viewport))) {
      visible.add(id)
    }

    // Retention, not admission: keep pinned nodes that are mounted, so an
    // off-screen selection made by select-all does not mount anything new.
    const pinned = getPinnedIds?.()
    if (pinned) {
      for (const id of pinned) {
        if (mounted.has(id)) visible.add(id)
      }
    }

    return visible
  }

  const pruneMountedNodes = useDebounceFn(() => {
    if (disposed) return
    mountedNodeIds.value = computeVisibleNodeIds()
  }, UNMOUNT_DELAY_MS)

  function refreshMountedNodes() {
    if (disposed) return
    const visible = computeVisibleNodeIds()
    const mounted = mountedNodeIds.value

    const entering: NodeId[] = []
    for (const id of visible) {
      if (!mounted.has(id)) entering.push(id)
    }

    let hasLeft = false
    for (const id of mounted) {
      if (!visible.has(id)) {
        hasLeft = true
        break
      }
    }

    if (entering.length > 0) {
      const next = new Set(mounted)
      const batch = entering.slice(0, MOUNT_BATCH_LIMIT)
      for (const id of batch) next.add(id)
      mountedNodeIds.value = next

      // More waiting than one flush should mount: continue next macrotask so
      // the renderer gets a frame in between.
      if (entering.length > batch.length) {
        setTimeout(() => refreshMountedNodes(), 32)
      }
    }

    if (!hasLeft) return

    // The debounced prune only runs once panning settles, so a long
    // continuous pan would otherwise keep every node it swept over mounted.
    // Once the mounted set is much larger than what is actually visible,
    // drop the stale entries immediately instead of waiting.
    if (mounted.size > visible.size * 2 + PRUNE_SLACK) {
      mountedNodeIds.value = visible
      return
    }

    void pruneMountedNodes()
  }

  const refreshThrottled = useThrottleFn(
    refreshMountedNodes,
    RECOMPUTE_THROTTLE_MS,
    true
  )

  watch(nodes, refreshMountedNodes, { immediate: true })

  watch(
    () => [camera.x, camera.y, camera.z],
    () => void refreshThrottled()
  )

  useEventListener(window, 'resize', refreshMountedNodes)

  // Backstop for the inputs with no watcher: node bounds (a drag moves nodes
  // without touching the camera), the pinned set, and canvas element size.
  // The fingerprint makes an idle tick cost a few comparisons and nothing
  // else, and is seeded now so the first tick does not read as a change and
  // spuriously restart the unmount debounce.
  const computeFingerprint = () => {
    const viewport = getViewportSize()
    const pinned = getPinnedIds?.()
    return `${layoutStore.nodeGeometryVersion}|${viewport.width}x${viewport.height}|${pinned?.size ?? 0}:${[...(pinned ?? [])].join(',')}`
  }
  let lastFingerprint = computeFingerprint()
  useIntervalFn(() => {
    if (disposed) return
    const fingerprint = computeFingerprint()
    if (fingerprint === lastFingerprint) return
    lastFingerprint = fingerprint
    refreshMountedNodes()
  }, BACKSTOP_INTERVAL_MS)

  tryOnScopeDispose(() => {
    disposed = true
  })

  return { mountedNodeIds }
}
