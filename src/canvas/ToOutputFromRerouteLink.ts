import type { LinkConnector } from "./LinkConnector"
import type { LGraphNode } from "@/LGraphNode"
import type { INodeInputSlot, INodeOutputSlot, LinkNetwork } from "@/litegraph"
import type { Reroute } from "@/Reroute"

import { ToInputRenderLink } from "./ToInputRenderLink"
import { ToOutputRenderLink } from "./ToOutputRenderLink"

/**
 * @internal A workaround class to support connecting to reroutes to node outputs.
 */
export class ToOutputFromRerouteLink extends ToOutputRenderLink {
  constructor(
    network: LinkNetwork,
    node: LGraphNode,
    fromSlot: INodeInputSlot,
    override readonly fromReroute: Reroute,
    readonly linkConnector: LinkConnector,
  ) {
    super(network, node, fromSlot, fromReroute)
  }

  override canConnectToReroute(): false {
    return false
  }

  override connectToOutput(node: LGraphNode, output: INodeOutputSlot) {
    const nuRenderLink = new ToInputRenderLink(this.network, node, output)
    this.linkConnector._connectOutputToReroute(this.fromReroute, nuRenderLink)
  }
}
