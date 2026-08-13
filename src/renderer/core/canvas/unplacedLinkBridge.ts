/**
 * Offers a link the connector could not place to the packs at either end.
 *
 * The API lives in `platform/` and cannot import `renderer/`, so the canvas
 * pushes the offer down rather than the API reaching up — the same seam
 * `nodeChangeBridge` uses.
 *
 * Both ends are asked, and the order is not arbitrary. The node that knows how
 * to place the link is the drop target in one direction and the drag's origin
 * in the other: dropping a bundle node's output on a sampler, the bundle is the
 * origin; dragging the sampler's input onto the bundle, it is the target. The
 * user aimed at the target, so the target is asked first.
 */
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { RenderLink } from '@/lib/litegraph/src/canvas/RenderLink'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
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

/**
 * The origin of the drag, when it is an ordinary node.
 *
 * A drag can start from a subgraph IO node, which has no type to look a pack
 * up by; those simply have no listener rather than a special case.
 */
function originNode(link: RenderLink): LGraphNode | undefined {
  const node = link.node as Partial<LGraphNode>
  return typeof node.type === 'string' ? (node as LGraphNode) : undefined
}

export function installUnplacedLinkBridge(canvas: LGraphCanvas): () => void {
  const handler = (
    detail: CustomEvent<{
      node: LGraphNode
      link: RenderLink
      side: 'input' | 'output'
      event: CanvasPointerEvent
    }>
  ) => {
    const { node, link, side, event } = detail.detail
    const origin = originNode(link)
    const type = String(link.fromSlot.type)
    // Ctrl is the host's answer to "overwrite what is already wired", so packs
    // stop keeping a global keyboard listener of their own to find out.
    const replaceExisting = event.ctrlKey || event.metaKey

    const placed =
      offer(
        node,
        side,
        { id: origin?.id, index: link.fromSlotIndex },
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
