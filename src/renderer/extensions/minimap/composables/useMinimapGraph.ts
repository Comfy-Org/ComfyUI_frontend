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
    digest = (Math.imul(digest, 31) + node.pos[0]) | 0
    digest = (Math.imul(digest, 31) + node.pos[1]) | 0
    digest = (Math.imul(digest, 31) + node.size[0]) | 0
    digest = (Math.imul(digest, 31) + node.size[1]) | 0
    digest = (Math.imul(digest, 31) + (node.mode ?? 0)) | 0
    digest = (Math.imul(digest, 31) + (node.has_errors ? 1 : 0)) | 0
  }
  return digest
}

/**
 * Rolling digest of link endpoints. Counting links alone would miss a rewire
 * that keeps the total unchanged.
 */
function computeLinkDigest(graph: LGraph): number {
  // Declared as a Map, but plain objects reach this at runtime too.
  const links: unknown = graph.links
  if (!links || typeof links !== 'object') return 0

  let digest = 0
  const mix = (link: unknown) => {
    if (!link || typeof link !== 'object') return
    const { origin_id: origin, target_id: target } = link as {
      origin_id?: unknown
      target_id?: unknown
    }
    // Non-numeric ids coerce to 0 via `| 0`; those rewires are still caught by
    // the onConnectionChange hook.
    digest = (Math.imul(digest, 31) + Number(origin)) | 0
    digest = (Math.imul(digest, 31) + Number(target)) | 0
  }

  if (links instanceof Map) {
    for (const link of links.values()) mix(link)
  } else {
    for (const link of Object.values(links)) mix(link)
  }

  return digest
}

export function useMinimapGraph(
  graph: Ref<LGraph | null>,
  onGraphChanged: () => void
) {
  let layoutDigest = 0
  let linkDigest = -1
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
    layoutDigest = 0
    linkDigest = -1
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
