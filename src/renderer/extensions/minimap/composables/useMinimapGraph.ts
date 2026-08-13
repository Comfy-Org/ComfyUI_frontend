import { useThrottleFn } from '@vueuse/core'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'

import type { UpdateFlags } from '../types'

interface GraphCallbacks {
  onNodeAdded?: (node: LGraphNode) => void
  onNodeRemoved?: (node: LGraphNode) => void
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
 * Rolling digest of every node's position, size and rendered state.
 *
 * Reads `graph._nodes` directly and allocates nothing, so it stays cheap on
 * large graphs. Digests can in principle collide, which would drop a single
 * minimap refresh — acceptable for an approximate overview, and the next
 * change re-syncs it.
 */
function computeLayoutDigest(graph: LGraph): number {
  let digest = graph._nodes.length
  for (const node of graph._nodes) {
    const [x, y] = node.pos
    const [width, height] = node.size
    digest = mixIn(digest, quantise(x))
    digest = mixIn(digest, quantise(y))
    digest = mixIn(digest, quantise(width))
    digest = mixIn(digest, quantise(height))
    digest = mixIn(digest, node.mode ?? 0)
    digest = mixIn(digest, node.has_errors ? 1 : 0)
  }
  return digest
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
  // Null rather than a numeric sentinel: 0 is a digest both functions produce
  // for an empty graph, so a numeric "no baseline" would be indistinguishable
  // from a real first reading.
  let layoutDigest: number | null = null
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
    onPropertyChanged: (
      e: CustomEvent<LGraphEventMap['node:property:changed']>
    ) => void
  }
  const hooksMap = new Map<string, InstalledHooks>()

  const handleGraphChangedThrottled = useThrottleFn(() => {
    onGraphChanged()
  }, 500)

  const setupEventListeners = () => {
    const g = graph.value
    if (!g || hooksMap.has(g.id)) return

    const originals: GraphCallbacks = {
      onNodeAdded: g.onNodeAdded,
      onNodeRemoved: g.onNodeRemoved,
      onConnectionChange: g.onConnectionChange
    }
    const wrappers: GraphCallbacks = {}

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
      onPropertyChanged
    }
    hooksMap.set(g.id, entry)

    wrappers.onNodeAdded = useChainCallback(originals.onNodeAdded, function () {
      if (!entry.live) return
      void handleGraphChangedThrottled()
    })
    g.onNodeAdded = wrappers.onNodeAdded

    wrappers.onNodeRemoved = useChainCallback(
      originals.onNodeRemoved,
      function () {
        if (!entry.live) return
        void handleGraphChangedThrottled()
      }
    )
    g.onNodeRemoved = wrappers.onNodeRemoved

    wrappers.onConnectionChange = useChainCallback(
      originals.onConnectionChange,
      function () {
        if (!entry.live) return
        void handleGraphChangedThrottled()
      }
    )
    g.onConnectionChange = wrappers.onConnectionChange

    g.events.addEventListener('node:property:changed', onPropertyChanged)
  }

  const cleanupEventListeners = (oldGraph?: LGraph) => {
    const g = oldGraph || graph.value
    if (!g) return
    const entry = hooksMap.get(g.id)
    if (!entry) return
    const { originals, wrappers } = entry

    if (g.onNodeAdded === wrappers.onNodeAdded)
      g.onNodeAdded = originals.onNodeAdded
    if (g.onNodeRemoved === wrappers.onNodeRemoved)
      g.onNodeRemoved = originals.onNodeRemoved
    if (g.onConnectionChange === wrappers.onConnectionChange)
      g.onConnectionChange = originals.onConnectionChange
    g.events.removeEventListener(
      'node:property:changed',
      entry.onPropertyChanged
    )

    entry.live = false
    hooksMap.delete(g.id)
  }

  const checkForChangesInternal = () => {
    const g = graph.value
    if (!g) return false

    const layout = computeLayoutDigest(g)
    const links = computeLinkDigest(g)

    const layoutChanged = layout !== layoutDigest
    const connectionChanged = links !== linkDigest

    layoutDigest = layout
    linkDigest = links

    if (layoutChanged) {
      updateFlags.value.bounds = true
      updateFlags.value.nodes = true
    }

    if (connectionChanged) {
      updateFlags.value.connections = true
    }

    return layoutChanged || connectionChanged
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
    layoutDigest = null
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
