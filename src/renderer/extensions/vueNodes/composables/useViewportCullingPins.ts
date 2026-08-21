import { useEventListener, useMutationObserver } from '@vueuse/core'
import { computed, nextTick, shallowRef, watchEffect } from 'vue'
import type { ComputedRef } from 'vue'

import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import type { NodeId } from '@/types/nodeId'

import { findLinkDragSourceIds, findNodesWithLiveState } from './liveNodeState'

interface ViewportCullingPinsOptions {
  selectedNodeIds: ComputedRef<ReadonlySet<NodeId>>
  getRoot: () => HTMLElement | null
  getLinkConnector: () => LinkConnector | null | undefined
}

export function useViewportCullingPins({
  selectedNodeIds,
  getRoot,
  getLinkConnector
}: ViewportCullingPinsOptions) {
  const focusedNodeId = shallowRef<NodeId | null>(null)
  const liveStateNodeIds = shallowRef<Set<NodeId>>(new Set())
  const linkDragSourceIds = shallowRef<Set<NodeId>>(new Set())

  function refreshFocusedNode(): void {
    queueMicrotask(() => {
      const root = getRoot()
      const activeElement = document.activeElement
      if (!root || !(activeElement instanceof Element)) {
        focusedNodeId.value = null
        return
      }
      const nodeElement = root.contains(activeElement)
        ? activeElement.closest('[data-node-id]')
        : null
      const nodeId = nodeElement?.getAttribute('data-node-id')
      focusedNodeId.value = nodeId ? (nodeId as NodeId) : null
    })
  }

  function refreshLiveState(): void {
    const root = getRoot()
    liveStateNodeIds.value = root ? findNodesWithLiveState(root) : new Set()
  }

  function refreshLinkDragSources(): void {
    linkDragSourceIds.value = findLinkDragSourceIds(getLinkConnector())
  }

  useEventListener(document, 'focusin', refreshFocusedNode, { capture: true })
  useEventListener(document, 'focusout', refreshFocusedNode, { capture: true })
  useEventListener(document, 'play', refreshLiveState, { capture: true })
  useEventListener(document, 'pause', refreshLiveState, { capture: true })
  useEventListener(document, 'ended', refreshLiveState, { capture: true })
  useEventListener(document, 'emptied', refreshLiveState, { capture: true })
  useMutationObserver(() => getRoot(), refreshLiveState, {
    childList: true,
    subtree: true
  })

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
    const result = new Set(selectedNodeIds.value)
    if (focusedNodeId.value) result.add(focusedNodeId.value)
    for (const nodeId of liveStateNodeIds.value) result.add(nodeId)
    for (const nodeId of linkDragSourceIds.value) result.add(nodeId)
    return result
  })

  return { pinnedNodeIds, refreshLiveState }
}
