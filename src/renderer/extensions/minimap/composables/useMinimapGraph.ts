import { useThrottleFn } from '@vueuse/core'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'

import type { UpdateFlags } from '../types'

interface GraphCallbacks {
  onConnectionChange?: (node: LGraphNode) => void
}

/**
 * Fixed-point quantisation for digest input, at eighth-pixel precision.
 * Mixing raw values would truncate at each `| 0`, so a drag or resize that
 * only changes the fractional part would leave the digest unchanged.
 */
function quantise(value: number): number {
  return Math.round(value * 8)
}

/**
 * Mixes one term into a rolling digest.
 *
 * The coercion is on the term, not the sum: `(digest + NaN) | 0` is 0, which
 * would discard every node mixed in so far and make an unrelated change
 * invisible for as long as the non-finite value stays in the graph.
 */
function mixIn(digest: number, value: number): number {
  return (Math.imul(digest, 31) + (Number.isFinite(value) ? value : 0)) | 0
}

/**
 * Cheap string hash for digest input (colors, execution states).
 */
function hashString(value: string): number {
  let hash = value.length
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0
  }
  return hash
}

interface GraphDigests {
  /** Node placement: drives bounds recomputation as well as repaint. */
  geometry: number
  /** Everything else the renderer draws: repaint only, bounds untouched. */
  visual: number
}

/**
 * Rolling digests over everything the minimap renders, in one allocation-free
 * pass. The digests are the single authority on "did the picture change":
 * event hooks and the poll are only signals to compare them, so any input the
 * renderer reads has to be mixed in here or changes to it stop repainting.
 *
 * Digests can in principle collide, which would drop a single refresh -
 * acceptable for an approximate overview, and the next change re-syncs it.
 */
function computeGraphDigests(graph: LGraph): GraphDigests {
  // Store-side geometry: the renderer reads layoutStore whenever it holds
  // nodes, so a write whose write-back to the litegraph node has not landed
  // must still count. Geometry version, not layoutVersion - that counts
  // operations, and zIndex alone fires one per widget pointerdown.
  let geometry = mixIn(layoutStore.nodeGeometryVersion, graph._nodes.length)
  let visual = 0

  for (const node of graph._nodes) {
    const [x, y] = node.pos
    const [width, height] = node.renderingSize
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

  // Execution state is drawn as discrete outline colors, so mixing the state
  // strings repaints exactly on transitions. Progress percentages are not
  // rendered, which is what lets the per-progress-message watcher go: the
  // poll picks up each transition within one tick at no per-message cost.
  const progressStates = useExecutionStore().nodeProgressStates
  for (const nodeId in progressStates) {
    const state = progressStates[nodeId]?.state
    if (!state) continue
    visual = mixIn(visual, hashString(nodeId))
    visual = mixIn(visual, hashString(state))
  }

  return { geometry, visual }
}

/**
 * Rolling digest of link endpoints and slots. Counting links alone would miss
 * a rewire that keeps the total unchanged, and endpoints alone would miss a
 * link moved to a different slot on the same pair of nodes.
 */
function computeLinkDigest(graph: LGraph): number {
  const links = graph.links
  if (!links) return 0

  let digest = 0
  for (const link of links.values()) {
    if (!link) continue
    // Node ids are branded strings and need not be numeric; non-numeric ones
    // contribute 0 here and are caught instead by the onConnectionChange hook.
    digest = mixIn(digest, Number(link.origin_id))
    digest = mixIn(digest, Number(link.target_id))
    digest = mixIn(digest, link.origin_slot)
    digest = mixIn(digest, link.target_slot)
  }

  return digest
}

export function useMinimapGraph(
  graph: Ref<LGraph | null>,
  onGraphChanged: () => void
) {
  // Null rather than a numeric sentinel: 0 is a digest these functions produce
  // for an empty graph, so a numeric "no baseline" would be indistinguishable
  // from a real first reading.
  let geometryDigest: number | null = null
  let visualDigest: number | null = null
  let linkDigest: number | null = null
  const updateFlags = ref<UpdateFlags>({
    bounds: false,
    nodes: false,
    connections: false,
    viewport: false
  })

  // Cleanup restores originals only when our wrapper is still on top, and
  // marks any buried wrapper inert via `entry.live` so it can't fire dead work.
  interface InstalledHooks {
    originals: GraphCallbacks
    wrappers: GraphCallbacks
    live: boolean
    disposeListeners: () => void
  }
  const hooksMap = new Map<string, InstalledHooks>()

  const handleGraphChangedThrottled = useThrottleFn(() => {
    onGraphChanged()
  }, 500)

  const setupEventListeners = () => {
    const g = graph.value
    if (!g || hooksMap.has(g.id)) return

    const originals: GraphCallbacks = {
      onConnectionChange: g.onConnectionChange
    }
    const wrappers: GraphCallbacks = {}

    const onNodeAdded = () => void handleGraphChangedThrottled()

    const onNodeRemoved = () => {
      void handleGraphChangedThrottled()
    }

    // A reload of the same workflow leaves the node count and every geometry
    // string identical, so change detection alone cannot tell that `bounds` was
    // last derived mid-configure, from a partially built graph.
    const onConfigured = () => {
      clearCache()
      void handleGraphChangedThrottled()
    }

    const onPropertyChanged = (
      e: CustomEvent<LGraphEventMap['node:property:changed']>
    ) => {
      const { property } = e.detail
      if (
        property === 'mode' ||
        property === 'bgcolor' ||
        property === 'color'
      ) {
        void handleGraphChangedThrottled()
      }
    }

    const entry: InstalledHooks = {
      originals,
      wrappers,
      live: true,
      disposeListeners: () => {
        g.events.removeEventListener('node:added', onNodeAdded)
        g.events.removeEventListener('node:removed', onNodeRemoved)
        g.events.removeEventListener('configured', onConfigured)
        g.events.removeEventListener('node:property:changed', onPropertyChanged)
      }
    }
    hooksMap.set(g.id, entry)

    wrappers.onConnectionChange = useChainCallback(
      originals.onConnectionChange,
      function () {
        if (!entry.live) return
        void handleGraphChangedThrottled()
      }
    )
    g.onConnectionChange = wrappers.onConnectionChange

    g.events.addEventListener('node:added', onNodeAdded)
    g.events.addEventListener('node:removed', onNodeRemoved)
    g.events.addEventListener('configured', onConfigured)
    g.events.addEventListener('node:property:changed', onPropertyChanged)
  }

  const cleanupEventListeners = (oldGraph?: LGraph) => {
    const g = oldGraph || graph.value
    if (!g) return
    const entry = hooksMap.get(g.id)
    if (!entry) return
    const { originals, wrappers } = entry

    if (g.onConnectionChange === wrappers.onConnectionChange)
      g.onConnectionChange = originals.onConnectionChange
    entry.disposeListeners()

    entry.live = false
    hooksMap.delete(g.id)
  }

  const checkForChangesInternal = () => {
    const g = graph.value
    if (!g) return false

    const { geometry, visual } = computeGraphDigests(g)
    const links = computeLinkDigest(g)

    const geometryChanged = geometry !== geometryDigest
    const visualChanged = visual !== visualDigest
    const connectionChanged = links !== linkDigest

    geometryDigest = geometry
    visualDigest = visual
    linkDigest = links

    // Only geometry moves the graph's extent; a recolour, group drag or
    // execution transition repaints without recomputing bounds.
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

  const init = () => {
    setupEventListeners()
    api.addEventListener('graphChanged', handleGraphChangedThrottled)
  }

  const destroy = () => {
    cleanupEventListeners()
    api.removeEventListener('graphChanged', handleGraphChangedThrottled)
    clearCache()
  }

  const clearCache = () => {
    geometryDigest = null
    visualDigest = null
    linkDigest = null
  }

  return {
    updateFlags,
    setupEventListeners,
    cleanupEventListeners,
    checkForChanges: checkForChangesInternal,
    init,
    destroy,
    clearCache
  }
}
