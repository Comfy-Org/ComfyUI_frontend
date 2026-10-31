import type {
  LGraphNode,
  LLink,
  Reroute,
  SubgraphOutput,
  SubgraphOutputNode
} from '@comfyorg/graph-model/entityRegistry'
import { transferLinkPresentation } from '#/transferLinkPresentation'
import { useLinkPresentationStore } from '@comfyorg/graph-state/linkPresentationStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { LinkPresentation } from '@comfyorg/graph-model/linkPresentation'

import type { CustomEventTarget } from '#/infrastructure/CustomEventTarget'
import type { LinkConnectorEventMap } from '@comfyorg/graph-model/LinkConnectorEventMap'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { SlotIndex } from '@comfyorg/graph-model/interfaces'
import type { INodeOutputSlot } from '@comfyorg/graph-model/slots'
import type { LinkNetwork } from '@comfyorg/graph-model/linkNetwork'

import type { NodeLike } from '#/types/NodeLike'
import { LinkDirection } from '@comfyorg/graph-model/globalEnums'
import type { SubgraphIO } from '@comfyorg/graph-model/serialisation'

import type { RenderLink } from './RenderLink'

/** Connecting TO an output slot. */

export class ToOutputFromIoNodeLink implements RenderLink {
  readonly toType = 'output'
  readonly fromPos: Point
  readonly fromSlotIndex: SlotIndex
  fromDirection: LinkDirection = LinkDirection.LEFT
  readonly isIoNodeLink = true
  private readonly presentation: Readonly<LinkPresentation> | undefined

  constructor(
    readonly network: LinkNetwork,
    readonly node: SubgraphOutputNode,
    readonly fromSlot: SubgraphOutput,
    readonly fromReroute?: Reroute,
    public dragDirection: LinkDirection = LinkDirection.CENTER,
    existingLink?: LLink
  ) {
    const inputIndex = node.slots.indexOf(fromSlot)
    if (inputIndex === -1 && fromSlot !== node.emptySlot) {
      throw new Error(
        `Creating render link for node [${this.node.id}] failed: Slot index not found.`
      )
    }

    this.fromSlotIndex = inputIndex
    this.fromPos = fromReroute ? fromReroute.pos : fromSlot.pos
    this.presentation = existingLink
      ? useLinkPresentationStore().getPresentation(
          graphScopeOf(node.subgraph),
          existingLink.id
        )
      : undefined
  }

  canConnectToInput(): false {
    return false
  }

  canConnectToOutput(
    outputNode: NodeLike,
    output: INodeOutputSlot | SubgraphIO
  ): boolean {
    return this.node.canConnectTo(outputNode, this.fromSlot, output)
  }

  canConnectToReroute(reroute: Reroute): boolean {
    if (reroute.origin_id === this.node.id) return false
    return true
  }

  connectToOutput(
    node: LGraphNode,
    output: INodeOutputSlot,
    events: CustomEventTarget<LinkConnectorEventMap>
  ) {
    const { fromSlot, fromReroute } = this

    const newLink = fromSlot.connect(output, node, fromReroute?.id)
    transferLinkPresentation(
      graphScopeOf(this.node.subgraph),
      this.presentation,
      newLink?.id
    )
    events.dispatch('link-created', newLink)
  }

  connectToSubgraphInput(): void {
    throw new Error('Not implemented')
  }

  connectToRerouteOutput(
    reroute: Reroute,
    outputNode: LGraphNode,
    output: INodeOutputSlot,
    events: CustomEventTarget<LinkConnectorEventMap>
  ): void {
    const { fromSlot } = this

    const newLink = fromSlot.connect(output, outputNode, reroute.id)
    transferLinkPresentation(
      graphScopeOf(this.node.subgraph),
      this.presentation,
      newLink?.id
    )
    events.dispatch('link-created', newLink)
  }

  connectToInput() {
    throw new Error('ToOutputRenderLink cannot connect to an input.')
  }

  connectToSubgraphOutput(): void {
    throw new Error('ToOutputRenderLink cannot connect to a subgraph output.')
  }

  connectToRerouteInput() {
    throw new Error('ToOutputRenderLink cannot connect to an input.')
  }
}
