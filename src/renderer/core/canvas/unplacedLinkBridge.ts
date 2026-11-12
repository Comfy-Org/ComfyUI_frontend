import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { RenderLink } from '@/lib/litegraph/src/canvas/RenderLink'
import type { LinkConnectorEventMap } from '@comfyorg/graph-model/LinkConnectorEventMap'
import { offerUnplacedLink } from '@/platform/nodeApi/defsRegistry'
import type { UnplacedLinkEvent } from '@/platform/nodeApi/defsRegistry'

function offer(
  node: LGraphNode | undefined,
  side: 'input' | 'output',
  peer: { id: unknown; index: number },
  type: string,
  replaceExisting: boolean
): boolean {
  if (!node?.type) return false
  const event: UnplacedLinkEvent = Object.freeze({
    side,
    peerNodeId: String(peer.id),
    peerIndex: peer.index,
    type,
    replaceExisting
  })
  return offerUnplacedLink(String(node.id), node.type, event)
}

function originNode(link: RenderLink): LGraphNode | undefined {
  return link.node instanceof LGraphNode ? link.node : undefined
}

export function installUnplacedLinkBridge(canvas: LGraphCanvas): () => void {
  const handler = (
    detail: CustomEvent<LinkConnectorEventMap['link-unplaced']>
  ) => {
    const { node, link, side, event } = detail.detail
    const origin = originNode(link)
    const type = String(link.fromSlot.type)
    const replaceExisting = event.ctrlKey || event.metaKey

    const placed =
      offer(
        node,
        side,
        { id: link.node.id, index: link.fromSlotIndex },
        type,
        replaceExisting
      ) ||
      offer(
        origin,
        side === 'input' ? 'output' : 'input',
        { id: node.id, index: link.fromSlotIndex },
        type,
        replaceExisting
      )

    if (placed) detail.preventDefault()
  }

  canvas.linkConnector.events.addEventListener('link-unplaced', handler)
  return () =>
    canvas.linkConnector.events.removeEventListener('link-unplaced', handler)
}
