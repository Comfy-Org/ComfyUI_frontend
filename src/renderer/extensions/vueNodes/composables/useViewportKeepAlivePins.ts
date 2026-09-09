import {
  useEventListener,
  useMutationObserver,
  useThrottleFn
} from '@vueuse/core'
import { computed, nextTick, shallowRef, watchEffect } from 'vue'

import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

const LIVE_STATE_SELECTOR = 'iframe, video, audio'

/**
 * Matches the sibling viewport composable's refresh cadence. The subtree scan
 * below runs against every attached node, and it fires on precisely the churn
 * KeepAlive generates - each activate and deactivate is a childList mutation
 * under the root - so unthrottled it would rescan on every batch of exactly
 * the work it exists to bound.
 */
const LIVE_STATE_SCAN_THROTTLE_MS = 100

interface LinkDragSource {
  isConnecting: boolean
  renderLinks: readonly { node?: { id?: unknown } | null }[]
}

export function findLiveStateNodeIds(root: ParentNode): Set<NodeId> {
  const nodeIds = new Set<NodeId>()
  for (const element of root.querySelectorAll(LIVE_STATE_SELECTOR)) {
    const isLive =
      element.tagName === 'IFRAME' ||
      (element instanceof HTMLMediaElement && !element.paused && !element.ended)
    if (!isLive) continue

    const nodeId = element
      .closest('[data-node-id]')
      ?.getAttribute('data-node-id')
    if (nodeId) nodeIds.add(toNodeId(nodeId))
  }
  return nodeIds
}

export function findLinkDragSourceIds(
  connector: LinkDragSource | null | undefined
): Set<NodeId> {
  const nodeIds = new Set<NodeId>()
  if (!connector?.isConnecting) return nodeIds

  for (const link of connector.renderLinks) {
    const nodeId = link.node?.id
    if (typeof nodeId === 'string' || typeof nodeId === 'number') {
      nodeIds.add(toNodeId(nodeId))
    }
  }
  return nodeIds
}

interface UseViewportKeepAlivePinsOptions {
  getRoot: () => HTMLElement | null
  getLinkConnector: () => LinkConnector | null | undefined
}

/**
 * Nodes that must stay attached while they hold state a detach would destroy:
 * the node being typed in (caret, IME composition), media mid-playback, an
 * iframe's document, and the source of a link drag in flight.
 *
 * Selection is deliberately not a pin. Under KeepAlive a detached node keeps
 * its component instance and its graph state, so selecting it costs nothing to
 * detach - and selection is the one input that can be graph-sized. Retaining
 * on selection lets select-all followed by a pan accumulate every node the
 * viewport ever touched, silently disabling the feature. Every pin here is
 * bounded by construction: one focus, one drag, and media that is actually
 * playing.
 */
export function useViewportKeepAlivePins({
  getRoot,
  getLinkConnector
}: UseViewportKeepAlivePinsOptions) {
  const focusedNodeId = shallowRef<NodeId | null>(null)
  const liveStateNodeIds = shallowRef<Set<NodeId>>(new Set())
  const linkDragSourceIds = shallowRef<Set<NodeId>>(new Set())

  function refreshFocusedNode(): void {
    queueMicrotask(() => {
      const root = getRoot()
      const activeElement = document.activeElement
      const nodeElement =
        root && activeElement instanceof Element && root.contains(activeElement)
          ? activeElement.closest('[data-node-id]')
          : null
      const nodeId = nodeElement?.getAttribute('data-node-id')
      focusedNodeId.value = nodeId ? toNodeId(nodeId) : null
    })
  }

  function refreshLiveState(): void {
    const root = getRoot()
    liveStateNodeIds.value = root ? findLiveStateNodeIds(root) : new Set()
  }
  const refreshLiveStateThrottled = useThrottleFn(
    refreshLiveState,
    LIVE_STATE_SCAN_THROTTLE_MS,
    true
  )

  function refreshLinkDragSources(): void {
    linkDragSourceIds.value = findLinkDragSourceIds(getLinkConnector())
  }

  useEventListener(document, 'focusin', refreshFocusedNode, { capture: true })
  useEventListener(document, 'focusout', refreshFocusedNode, { capture: true })
  useEventListener(document, 'play', refreshLiveState, { capture: true })
  useEventListener(document, 'pause', refreshLiveState, { capture: true })
  useEventListener(document, 'ended', refreshLiveState, { capture: true })
  // Not re-entrant: the scan reads the DOM and writes a shallowRef; it adds
  // and removes nothing under the root, so it cannot re-trigger itself.
  useMutationObserver(
    () => getRoot(),
    () => void refreshLiveStateThrottled(),
    {
      childList: true,
      subtree: true
    }
  )

  watchEffect((onCleanup) => {
    const connector = getLinkConnector()
    if (!connector) return

    const refreshAfterReset = () => queueMicrotask(refreshLinkDragSources)
    connector.events.addEventListener('drag-started', refreshLinkDragSources)
    connector.events.addEventListener('reset', refreshAfterReset)
    refreshLinkDragSources()

    onCleanup(() => {
      connector.events.removeEventListener(
        'drag-started',
        refreshLinkDragSources
      )
      connector.events.removeEventListener('reset', refreshAfterReset)
    })
  })

  void nextTick(refreshLiveState)

  const pinnedNodeIds = computed(() => {
    const nodeIds = new Set<NodeId>()
    if (focusedNodeId.value) nodeIds.add(focusedNodeId.value)
    for (const nodeId of liveStateNodeIds.value) nodeIds.add(nodeId)
    for (const nodeId of linkDragSourceIds.value) nodeIds.add(nodeId)
    return nodeIds
  })

  return { pinnedNodeIds }
}
