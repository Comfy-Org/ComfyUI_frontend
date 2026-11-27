import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

function isLiveMedia(element: Element): boolean {
  return (
    element.tagName === 'IFRAME' ||
    (element instanceof HTMLMediaElement && !element.paused && !element.ended)
  )
}

function owningNodeId(element: Element): NodeId | undefined {
  const nodeId = element.closest('[data-node-id]')?.getAttribute('data-node-id')
  return nodeId ? toNodeId(nodeId) : undefined
}

/** Nodes whose live DOM state would be lost if they were unmounted now. */
export function findLodPinnedNodeIds(
  root: HTMLElement | null,
  linkConnector: LinkConnector | null | undefined
): Set<NodeId> {
  const elements: Element[] = []
  if (root) {
    elements.push(
      ...[...root.querySelectorAll('iframe, video, audio')].filter(isLiveMedia)
    )
    const focused = document.activeElement
    if (focused && root.contains(focused)) elements.push(focused)
  }

  const nodeIds = new Set<NodeId>()
  for (const element of elements) {
    const nodeId = owningNodeId(element)
    if (nodeId !== undefined) nodeIds.add(nodeId)
  }
  if (linkConnector?.isConnecting) {
    for (const link of linkConnector.renderLinks) nodeIds.add(link.node.id)
  }
  return nodeIds
}
