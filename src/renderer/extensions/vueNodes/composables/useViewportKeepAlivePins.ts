import {
  useEventListener,
  useMutationObserver,
  useThrottleFn
} from '@vueuse/core'
import { computed, nextTick, shallowRef, watch } from 'vue'

import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

const LIVE_STATE_SELECTOR = 'iframe, video, audio'
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

  useEventListener(document, ['focusin', 'focusout'], refreshFocusedNode, {
    capture: true
  })
  useEventListener(document, ['play', 'pause', 'ended'], refreshLiveState, {
    capture: true
  })
  useMutationObserver(getRoot, () => void refreshLiveStateThrottled(), {
    childList: true,
    subtree: true
  })

  watch(getLinkConnector, refreshLinkDragSources, { immediate: true })
  useEventListener(
    () => getLinkConnector()?.events,
    'drag-started',
    refreshLinkDragSources
  )
  useEventListener(
    () => getLinkConnector()?.events,
    'reset',
    () => queueMicrotask(refreshLinkDragSources)
  )

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
