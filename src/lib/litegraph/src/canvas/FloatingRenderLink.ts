import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import type { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LinkConnectorEventMap } from '@/lib/litegraph/src/infrastructure/LinkConnectorEventMap'
import {
  completeFloatingLink,
  replaceFloatingLink
} from '@/lib/litegraph/src/linkReplacement'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  LinkNetwork,
  Point,
  SlotIndex
} from '@/lib/litegraph/src/interfaces'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'

import type { RenderLink } from './RenderLink'

/**
 * Represents a floating link that is currently being dragged from one slot to another.
 *
 * This is a heavier, but short-lived convenience data structure. All refs to FloatingRenderLinks should be discarded on drop.
 * @remarks
 * At time of writing, Litegraph is using several different styles and methods to handle link dragging.
 *
 * Once the library has undergone more substantial changes to the way links are managed,
 * many properties of this class will be superfluous and removable.
 */
export class FloatingRenderLink implements RenderLink {
  readonly node: LGraphNode
  readonly fromSlot: INodeOutputSlot | INodeInputSlot
  readonly fromPos: Point
  readonly fromDirection: LinkDirection
  readonly fromSlotIndex: SlotIndex

  readonly outputNodeId: NodeId = UNASSIGNED_NODE_ID
  readonly outputNode?: LGraphNode
  readonly outputSlot?: INodeOutputSlot
  readonly outputIndex: number = -1
  readonly outputPos?: Point

  readonly inputNodeId: NodeId = UNASSIGNED_NODE_ID
  readonly inputNode?: LGraphNode
  readonly inputSlot?: INodeInputSlot
  readonly inputIndex: number = -1
  readonly inputPos?: Point

  constructor(
    readonly network: LinkNetwork,
    public link: LLink,
    readonly toType: 'input' | 'output',
    readonly fromReroute: Reroute,
    readonly dragDirection: LinkDirection = LinkDirection.CENTER
  ) {
    const {
      origin_id: outputNodeId,
      target_id: inputNodeId,
      origin_slot: outputIndex,
      target_slot: inputIndex
    } = link

    if (outputNodeId !== UNASSIGNED_NODE_ID) {
      // Output connected
      const outputNode = network.getNodeById(outputNodeId) ?? undefined
      if (!outputNode)
        throw new Error(
          `Creating DraggingRenderLink for link [${link.id}] failed: Output node [${outputNodeId}] not found.`
        )

      const outputSlot = outputNode?.outputs.at(outputIndex)
      if (!outputSlot)
        throw new Error(
          `Creating DraggingRenderLink for link [${link.id}] failed: Output slot [${outputIndex}] not found.`
        )

      this.outputNodeId = outputNodeId
      this.outputNode = outputNode
      this.outputSlot = outputSlot
      this.outputIndex = outputIndex
      this.outputPos = outputNode.getOutputPos(outputIndex)

      // RenderLink props
      this.node = outputNode
      this.fromSlot = outputSlot
      this.fromPos = fromReroute?.pos ?? this.outputPos
      this.fromDirection = LinkDirection.LEFT
      this.dragDirection = LinkDirection.RIGHT
      this.fromSlotIndex = outputIndex
    } else {
      // Input connected
      const inputNode = network.getNodeById(inputNodeId) ?? undefined
      if (!inputNode)
        throw new Error(
          `Creating DraggingRenderLink for link [${link.id}] failed: Input node [${inputNodeId}] not found.`
        )

      const inputSlot = inputNode?.inputs.at(inputIndex)
      if (!inputSlot)
        throw new Error(
          `Creating DraggingRenderLink for link [${link.id}] failed: Input slot [${inputIndex}] not found.`
        )

      this.inputNodeId = inputNodeId
      this.inputNode = inputNode
      this.inputSlot = inputSlot
      this.inputIndex = inputIndex
      this.inputPos = inputNode.getInputPos(inputIndex)

      // RenderLink props
      this.node = inputNode
      this.fromSlot = inputSlot
      this.fromDirection = LinkDirection.RIGHT
      this.fromSlotIndex = inputIndex
    }
    this.fromPos = fromReroute.pos
  }

  canConnectToInput(): boolean {
    return this.toType === 'input'
  }

  canConnectToOutput(): boolean {
    return this.toType === 'output'
  }

  canConnectToReroute(reroute: Reroute): boolean {
    if (this.toType === 'input') {
      if (reroute.origin_id === this.inputNode?.id) return false
    } else {
      if (reroute.origin_id === this.outputNode?.id) return false
    }
    return true
  }

  canConnectToSubgraphInput(input: SubgraphInput): boolean {
    return this.toType === 'output' && input.isValidTarget(this.fromSlot)
  }

  connectToInput(
    node: LGraphNode,
    input: INodeInputSlot,
    _events?: CustomEventTarget<LinkConnectorEventMap>
  ): void {
    // Disconnect before re-targeting, or the floating link would be
    // caught (and removed) by the target slot's floating-link cleanup.
    node.disconnectInput(node.inputs.indexOf(input))

    this.link = replaceFloatingLink(this.network, this.link, {
      originId: this.link.origin_id,
      originSlot: this.link.origin_slot,
      targetId: node.id,
      targetSlot: node.inputs.indexOf(input)
    })
  }

  connectToOutput(
    node: LGraphNode,
    output: INodeOutputSlot,
    _events?: CustomEventTarget<LinkConnectorEventMap>
  ): void {
    this.link = replaceFloatingLink(this.network, this.link, {
      originId: node.id,
      originSlot: node.outputs.indexOf(output),
      targetId: this.link.target_id,
      targetSlot: this.link.target_slot
    })
  }

  connectToSubgraphInput(
    input: SubgraphInput,
    _events?: CustomEventTarget<LinkConnectorEventMap>
  ): void {
    if (!this.inputNode || !this.inputSlot) return
    const replacement = input.connect(
      this.inputSlot,
      this.inputNode,
      this.link.parentId
    )
    if (replacement)
      this.link = completeFloatingLink(this.network, this.link, replacement)
  }

  connectToSubgraphOutput(
    output: SubgraphOutput,
    _events?: CustomEventTarget<LinkConnectorEventMap>
  ): void {
    if (!this.outputNode || !this.outputSlot) return
    const replacement = output.connect(
      this.outputSlot,
      this.outputNode,
      this.link.parentId
    )
    if (replacement)
      this.link = completeFloatingLink(this.network, this.link, replacement)
  }

  connectToRerouteInput(
    // @ts-expect-error - Reroute type needs fixing
    reroute: Reroute,
    { node: inputNode, input }: { node: LGraphNode; input: INodeInputSlot },
    events: CustomEventTarget<LinkConnectorEventMap>
  ) {
    this.link = replaceFloatingLink(this.network, this.link, {
      originId: this.link.origin_id,
      originSlot: this.link.origin_slot,
      targetId: inputNode.id,
      targetSlot: inputNode.inputs.indexOf(input)
    })

    events.dispatch('input-moved', this)
  }

  connectToRerouteOutput(
    // @ts-expect-error - Reroute type needs fixing
    reroute: Reroute,
    outputNode: LGraphNode,
    output: INodeOutputSlot,
    events: CustomEventTarget<LinkConnectorEventMap>
  ) {
    this.link = replaceFloatingLink(this.network, this.link, {
      originId: outputNode.id,
      originSlot: outputNode.outputs.indexOf(output),
      targetId: this.link.target_id,
      targetSlot: this.link.target_slot
    })

    events.dispatch('output-moved', this)
  }
}
