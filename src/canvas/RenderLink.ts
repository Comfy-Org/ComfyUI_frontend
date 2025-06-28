import type { CustomEventTarget } from "@/infrastructure/CustomEventTarget"
import type { LinkConnectorEventMap } from "@/infrastructure/LinkConnectorEventMap"
import type { LinkNetwork, Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { INodeInputSlot, INodeOutputSlot, LLink, Reroute } from "@/litegraph"
import type { SubgraphInput } from "@/subgraph/SubgraphInput"
import type { SubgraphIONodeBase } from "@/subgraph/SubgraphIONodeBase"
import type { SubgraphOutput } from "@/subgraph/SubgraphOutput"
import type { LinkDirection } from "@/types/globalEnums"

export interface RenderLink {
  /** The type of link being connected. */
  readonly toType: "input" | "output"
  /** The source {@link Point} of the link being connected. */
  readonly fromPos: Point
  /** The direction the link starts off as.  If {@link toType} is `output`, this will be the direction the link input faces. */
  readonly fromDirection: LinkDirection
  /** If set, this will force a dragged link "point" from the cursor in the specified direction. */
  dragDirection: LinkDirection

  /** The network that the link belongs to. */
  readonly network: LinkNetwork
  /** The node that the link is being connected from. */
  readonly node: LGraphNode | SubgraphIONodeBase<SubgraphInput | SubgraphOutput>
  /** The slot that the link is being connected from. */
  readonly fromSlot: INodeOutputSlot | INodeInputSlot | SubgraphInput | SubgraphOutput
  /** The index of the slot that the link is being connected from. */
  readonly fromSlotIndex: number
  /** The reroute that the link is being connected from. */
  readonly fromReroute?: Reroute

  connectToInput(node: LGraphNode, input: INodeInputSlot, events?: CustomEventTarget<LinkConnectorEventMap>): void
  connectToOutput(node: LGraphNode, output: INodeOutputSlot, events?: CustomEventTarget<LinkConnectorEventMap>): void
  connectToSubgraphInput(input: SubgraphInput, events?: CustomEventTarget<LinkConnectorEventMap>): void
  connectToSubgraphOutput(output: SubgraphOutput, events?: CustomEventTarget<LinkConnectorEventMap>): void

  connectToRerouteInput(
    reroute: Reroute,
    { node, input, link }: { node: LGraphNode, input: INodeInputSlot, link: LLink },
    events: CustomEventTarget<LinkConnectorEventMap>,
    originalReroutes: Reroute[],
  ): void

  connectToRerouteOutput(
    reroute: Reroute,
    outputNode: LGraphNode,
    output: INodeOutputSlot,
    events: CustomEventTarget<LinkConnectorEventMap>,
  ): void
}
