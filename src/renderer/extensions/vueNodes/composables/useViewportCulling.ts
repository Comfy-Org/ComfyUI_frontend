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
 * Quiet period after the last zoom step before the mounted set is recomputed.
 *
 * A zoom sweeps through scales the user is passing over, not stopping at, and
 * each intermediate scale would mount a different set - the expensive half of
 * the work, thrown away a frame later. Existing nodes keep scaling via the
 * pane transform throughout, which costs nothing extra, so deferring only
 * changes when new nodes appear.
 */
const ZOOM_SETTLE_MS = 160

/**
 * Extra mounted nodes tolerated before pruning eagerly, so small graphs are
 * not pruned on every recompute.
 */
const PRUNE_SLACK = 8

/**
 * Starting number of component trees to mount per animation frame.
 *
 * Adapted from there against real frame cost, because per-node mount cost
 * varies by an order of magnitude with zoom: cheap at working zoom, and
 * roughly 8-14ms each at minimum zoom where every mount also lays out and
 * measures a scaled subtree. No fixed number is right for both.
 */
export const MOUNT_BATCH_PER_FRAME = 8

/**
 * Smallest batch backpressure may shrink to.
 *
 * Distinct from the starting size on purpose: when the floor equals the start,
 * the shrink branch can never produce a value the fill did not already begin
 * with, so on a machine whose frames exceed the budget with zero mounting the
 * controller pins at the default and looks like it is working.
 */
const MOUNT_BATCH_FLOOR = 2

/** Largest batch, and so the bound on the worst frame the fill-in can produce. */
const MOUNT_BATCH_CEILING = MOUNT_BATCH_PER_FRAME * 8

/** Frame budget the fill-in tries to stay within, in milliseconds. */
const MOUNT_FRAME_BUDGET_MS = 20

/**
 * How long a staged fill-in may take before the remainder is mounted at once.
 *
 * Backpressure alone can deadlock: a mass paste makes frames slow for reasons
 * that have nothing to do with mounting, the batch shrinks in response, and
 * frames stay slow, so it never recovers and nodes trickle in one per frame.
 * One bounded hitch is better than a fill-in the user watches crawl.
 */
const MOUNT_QUEUE_DEADLINE_MS = 600

/**
 * Fraction of {@link MIN_NODES_FOR_CULLING} the graph must shrink past before
 * culling switches back off, once it is on.
 */
const GATE_HYSTERESIS = 0.9

/**
 * Graph size below which nothing is culled.
 *
 * Ordinary workflows are an order of magnitude smaller, render fine whole, and
 * take none of culling's interaction risk. Chosen from measurement rather than
 * feel: panning an unculled graph on a 4x-throttled CPU (roughly a mid-range
 * laptop) costs 37.6ms/frame at 150 nodes against 18.6ms culled, so this is
 * where culling starts being decisive for the machines that need it. On a fast
 * machine the same graph is 8ms either way, so a threshold set from local
 * timings alone would land far too high.
 */
const MIN_NODES_FOR_CULLING = 150

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
  /**
   * Nodes that must always be mounted, whether or not they ever entered the
   * viewport. Admission, unlike the retention above: for nodes owning real DOM
   * elements, unmounting destroys state that re-rendering cannot rebuild, so
   * they are excluded from culling entirely. Expected to be a small minority -
   * anything that grows with graph size belongs in the retention set instead.
   */
  getAlwaysMountedIds?: () => ReadonlySet<NodeId> | undefined
  /**
   * Whether culling should run at all. A getter rather than a plain boolean so
   * that turning it back on recomputes the mounted set: while off, that set
   * converges to empty, and a caller filtering against a stale empty set would
   * render nothing.
   */
  isEnabled?: () => boolean
  /** Graph size below which nothing is culled. Defaults to MIN_NODES_FOR_CULLING. */
  minNodesForCulling?: number
}

export function useViewportCulling({
  nodes,
  queryNodesInBounds,
  getViewportSize,
  getPinnedIds,
  getAlwaysMountedIds,
  isEnabled,
  minNodesForCulling = MIN_NODES_FOR_CULLING
}: UseViewportCullingOptions) {
  const { camera } = useTransformState()
  const mountedNodeIds = shallowRef<Set<NodeId>>(new Set())

  // VueUse debounce/throttle timers use a bare setTimeout with no scope hook,
  // so a queued trailing callback outlives the component on workflow switch or
  // route change and would recompute against a torn-down canvas.
  let disposed = false

  /**
   * Small graphs render whole; see MIN_NODES_FOR_CULLING.
   *
   * Latched, because the gate swaps the entire mounted set rather than its
   * edge: without it, deleting one node from a graph sitting on the boundary
   * turns culling off and mounts everything that was culled, and undo/redo
   * across the boundary repeats it on every keystroke. Once on, it stays on
   * until the graph is clearly smaller.
   */
  let cullingLatched = false
  const isCullingWorthwhile = () => {
    if (isEnabled?.() === false) {
      cullingLatched = false
      return false
    }

    const count = nodes.value.length
    cullingLatched = cullingLatched
      ? count >= minNodesForCulling * GATE_HYSTERESIS
      : count >= minNodesForCulling
    return cullingLatched
  }

  function computeVisibleNodeIds(): Set<NodeId> {
    const visible = new Set<NodeId>()
    const viewport = getViewportSize()
    const mounted = mountedNodeIds.value

    if (!isCullingWorthwhile()) {
      for (const node of nodes.value) visible.add(node.id)
      return visible
    }

    // No measurable viewport (canvas absent, or hidden by App mode's
    // display:none). Nothing can be judged visible or hidden, so hold the
    // current set rather than defaulting open and mounting the whole graph.
    if (!viewport.width || !viewport.height) {
      const held = new Set(mounted)
      for (const id of getAlwaysMountedIds?.() ?? []) held.add(id)
      return held
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

    for (const id of getAlwaysMountedIds?.() ?? []) visible.add(id)

    return visible
  }

  // Nodes waiting to mount, drained a batch per frame. Kept outside the
  // mounted set so an interrupted fill-in leaves no partial state behind.
  let mountQueue: NodeId[] = []
  let mountFrame: number | null = null

  function cancelQueuedMounts(): void {
    mountQueue = []
    lastDrainAt = 0
    queueStartedAt = 0
    mountBatchSize = MOUNT_BATCH_PER_FRAME
    if (mountFrame !== null) {
      cancelAnimationFrame(mountFrame)
      mountFrame = null
    }
  }

  /**
   * Batch size, adapted against the frame the previous batch produced. Vue
   * renders after the set is assigned, so the cost cannot be measured while
   * mounting - only observed on the next frame and corrected for.
   */
  let mountBatchSize = MOUNT_BATCH_PER_FRAME
  let lastDrainAt = 0
  let queueStartedAt = 0

  function drainMountQueue(now: number): void {
    mountFrame = null
    if (disposed || mountQueue.length === 0) return

    // Past the deadline, stop adapting rather than stop pacing. Draining the
    // whole remainder in one assignment is unbounded - the queue is sized by
    // the viewport query, which at minimum zoom is most of the graph - so it
    // trades a crawl for a multi-second freeze. Pinning the batch high keeps
    // the worst frame bounded by MOUNT_BATCH_CEILING instead.
    const pastDeadline =
      queueStartedAt > 0 && now - queueStartedAt > MOUNT_QUEUE_DEADLINE_MS

    if (pastDeadline) {
      mountBatchSize = MOUNT_BATCH_CEILING
    } else if (lastDrainAt > 0) {
      const frameMs = now - lastDrainAt
      if (frameMs > MOUNT_FRAME_BUDGET_MS) {
        mountBatchSize = Math.max(
          MOUNT_BATCH_FLOOR,
          Math.floor(mountBatchSize / 2)
        )
      } else {
        mountBatchSize = Math.min(MOUNT_BATCH_CEILING, mountBatchSize * 2)
      }
    }
    lastDrainAt = now

    const batch = mountQueue.splice(0, mountBatchSize)
    const next = new Set(mountedNodeIds.value)
    for (const id of batch) next.add(id)
    mountedNodeIds.value = next

    if (mountQueue.length > 0) {
      mountFrame = requestAnimationFrame(drainMountQueue)
    }
  }

  function queueMount(entering: NodeId[], immediate = false): void {
    cancelQueuedMounts()
    if (entering.length === 0) return

    // Nodes that just appeared in the graph - a paste, a drop, an undo - are a
    // direct user action awaiting feedback, and the set is already bounded by
    // the viewport. Pacing those is what makes a large paste look like it is
    // rendering one node at a time.
    if (immediate) {
      const all = new Set(mountedNodeIds.value)
      for (const id of entering) all.add(id)
      mountedNodeIds.value = all
      return
    }

    queueStartedAt = performance.now()

    // First batch synchronously so a small change appears this frame rather
    // than a frame late; the rest fills in over following frames.
    const firstBatch = entering.slice(0, MOUNT_BATCH_PER_FRAME)
    const next = new Set(mountedNodeIds.value)
    for (const id of firstBatch) next.add(id)
    mountedNodeIds.value = next

    mountQueue = entering.slice(firstBatch.length)
    if (mountQueue.length > 0) {
      mountFrame = requestAnimationFrame(drainMountQueue)
    }
  }

  /**
   * Drops departed nodes, and only those.
   *
   * Assigning the full visible set here would also admit everything still
   * sitting in the mount queue, so a pan that stops with hundreds queued would
   * mount the whole remainder in one write 250ms later - the single flush the
   * queue exists to avoid, arriving exactly where frames are slowest.
   */
  const pruneMountedNodes = useDebounceFn(() => {
    if (disposed) return
    const visible = computeVisibleNodeIds()
    const mounted = mountedNodeIds.value
    const retained = new Set<NodeId>()
    for (const id of mounted) {
      if (visible.has(id)) retained.add(id)
    }
    if (retained.size !== mounted.size) mountedNodeIds.value = retained
  }, UNMOUNT_DELAY_MS)

  /**
   * Replaces the mounted set outright, cancelling any fill still in flight.
   *
   * That queue was computed for a camera position that no longer applies, so
   * draining it afterwards re-adds ids this just dropped, each frame paying a
   * full Set copy and a shallowRef reassign for no visual change.
   */
  function commitMountedNodes(visible: Set<NodeId>): void {
    cancelQueuedMounts()
    mountedNodeIds.value = visible
  }

  /**
   * @param allowMount false while a zoom gesture is in flight: the set is
   * still pruned, so zooming in sheds nodes and gets cheaper as it goes, but
   * nothing new mounts until the gesture settles.
   */
  function refreshMountedNodes(allowMount = true, immediate = false) {
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

    if (allowMount) {
      // Replaces rather than appends: the previous queue was computed for a
      // camera position the user has already left, so anything still in it is
      // either in `entering` again or no longer wanted.
      queueMount(entering, immediate)
    } else {
      cancelQueuedMounts()
    }

    if (!hasLeft) return

    // The debounced prune only runs once panning settles, so a long
    // continuous pan would otherwise keep every node it swept over mounted.
    // Once the mounted set is much larger than what is actually visible,
    // drop the stale entries immediately instead of waiting.
    if (mounted.size > visible.size * 2 + PRUNE_SLACK) {
      commitMountedNodes(visible)
      return
    }

    void pruneMountedNodes()
  }

  const refreshThrottled = useThrottleFn(
    () => refreshMountedNodes(),
    RECOMPUTE_THROTTLE_MS,
    true
  )

  const refreshThrottledPruneOnly = useThrottleFn(
    () => refreshMountedNodes(false),
    RECOMPUTE_THROTTLE_MS,
    true
  )

  // Membership changes mount without pacing; see queueMount.
  watch(nodes, () => refreshMountedNodes(true, true), { immediate: true })

  // The backstop's fingerprint does not include this flag, so without an
  // explicit watch, switching culling on has no effect until some other signal
  // happens to change - the graph stays fully mounted and the setting appears
  // to do nothing.
  if (isEnabled) {
    watch(
      () => isEnabled(),
      () => refreshMountedNodes(true, true)
    )
  }

  const refreshAfterZoom = useDebounceFn(() => {
    if (disposed) return
    refreshMountedNodes()
  }, ZOOM_SETTLE_MS)

  let lastScale = camera.z
  watch(
    () => [camera.x, camera.y, camera.z],
    () => {
      // Zooming: defer entirely until the gesture settles. Panning keeps its
      // throttled refresh, because a pan moves into genuinely new territory
      // and has to mount as it goes.
      if (camera.z !== lastScale) {
        lastScale = camera.z
        // Prune as the gesture runs so zooming in sheds nodes; defer mounting
        // until it settles.
        void refreshThrottledPruneOnly()
        void refreshAfterZoom()
        return
      }
      void refreshThrottled()
    }
  )

  useEventListener(window, 'resize', () => refreshMountedNodes())

  // Backstop for the inputs with no watcher: node bounds (a drag moves nodes
  // without touching the camera), the pinned set, and canvas element size.
  // The fingerprint makes an idle tick cost a few comparisons and nothing
  // else, and is seeded now so the first tick does not read as a change and
  // spuriously restart the unmount debounce.
  // Order-independent, and no per-tick string of the whole pinned set: joining
  // it allocates and discards proportional to selection size on every tick, and
  // makes a reorder with identical membership read as a change.
  const computeFingerprint = () => {
    const viewport = getViewportSize()
    const pinned = getPinnedIds?.()
    let pinnedDigest = 0
    for (const id of pinned ?? []) {
      let hash = 0
      const text = String(id)
      for (let i = 0; i < text.length; i++) {
        hash = (Math.imul(hash, 31) + text.charCodeAt(i)) | 0
      }
      pinnedDigest = (pinnedDigest + hash) | 0
    }
    return `${layoutStore.nodeGeometryVersion}|${viewport.width}x${viewport.height}|${pinned?.size ?? 0}:${pinnedDigest}`
  }
  let lastFingerprint = computeFingerprint()
  useIntervalFn(() => {
    if (disposed) return

    // nodeGeometryVersion bumps on every position write, so during a drag or
    // auto-pan the fingerprint differs on every tick and this would rebuild the
    // spatial index - decoding the whole layout map - 4x/sec for as long as the
    // drag lasts. Before culling existed, a drag with a stationary camera did
    // not touch the index at all. The camera watch still covers any real
    // viewport change during the drag.
    if (layoutStore.isDraggingVueNodes.value) return

    const fingerprint = computeFingerprint()
    if (fingerprint === lastFingerprint) return
    lastFingerprint = fingerprint
    refreshMountedNodes()
  }, BACKSTOP_INTERVAL_MS)

  tryOnScopeDispose(() => {
    disposed = true
    cancelQueuedMounts()
  })

  return { mountedNodeIds }
}
