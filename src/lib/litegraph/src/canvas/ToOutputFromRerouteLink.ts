import { transferLinkPresentation } from '@/core/graph/transferLinkPresentation'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  LinkNetwork
} from '@/lib/litegraph/src/litegraph'

import type { LinkConnector } from './LinkConnector'
import { ToInputRenderLink } from './ToInputRenderLink'
import { ToOutputRenderLink } from './ToOutputRenderLink'

/**
 * @internal A workaround class to support connecting to reroutes to node outputs.
 */
export class ToOutputFromRerouteLink extends ToOutputRenderLink {
  constructor(
    network: LinkNetwork,
    node: LGraphNode,
    fromSlot: INodeInputSlot,
    override readonly fromReroute: Reroute,
    readonly linkConnector: LinkConnector
  ) {
    super(network, node, fromSlot, fromReroute)
  }

  override canConnectToReroute(): false {
    return false
  }

  override connectToOutput(node: LGraphNode, output: INodeOutputSlot) {
    const graph = this.node.graph
    if (!graph) return
    const scope = graphScopeOf(graph)
    const store = useLinkPresentationStore()
    const targets = (this.fromReroute.findTargetInputs() ?? []).map(
      ({ input, link }) => ({
        input,
        linkId: link.id,
        presentation: store.getPresentation(scope, link.id)
      })
    )
    const nuRenderLink = new ToInputRenderLink(this.network, node, output)
    this.linkConnector._connectOutputToReroute(this.fromReroute, nuRenderLink)
    for (const { input, linkId, presentation } of targets) {
      const replacement =
        input.link == null ? undefined : this.network.links.get(input.link)
      if (
        replacement &&
        replacement.id !== linkId &&
        replacement.origin_id === node.id &&
        replacement.origin_slot === nuRenderLink.fromSlotIndex
      ) {
        transferLinkPresentation(scope, presentation, replacement.id)
      }
    }
  }
}
