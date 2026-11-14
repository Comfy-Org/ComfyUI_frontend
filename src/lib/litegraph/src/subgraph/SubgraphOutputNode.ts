import type {
  LGraphNode,
  LLink,
  LinkConnector,
  SubgraphInput,
  SubgraphOutput
} from '@comfyorg/graph-model/entityRegistry'

import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { RerouteId } from '@comfyorg/graph-model/rerouteId'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import type {
  DefaultConnectionColors,
  ISlotType,
  Positionable
} from '@comfyorg/graph-model/interfaces'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'
import type { NodeLike } from '@/lib/litegraph/src/types/NodeLike'
import type { SubgraphIO } from '@comfyorg/graph-model/serialisation'
import { findFreeSlotOfType } from '@/lib/litegraph/src/utils/collections'

import { EmptySubgraphOutput } from './EmptySubgraphOutput'
import { SubgraphIONodeBase } from './SubgraphIONodeBase'

import { provideSubgraphOutputGuard } from './subgraphTypeGuards'

export class SubgraphOutputNode
  extends SubgraphIONodeBase<SubgraphOutput>
  implements Positionable
{
  readonly id: NodeId = SUBGRAPH_OUTPUT_ID
  readonly slotDirection = 'input'

  readonly emptySlot: EmptySubgraphOutput = new EmptySubgraphOutput(this)

  get slots() {
    return this.subgraph.outputs
  }

  override get allSlots(): SubgraphOutput[] {
    return [...this.slots, this.emptySlot]
  }

  get slotAnchorX() {
    const [x] = this.boundingRect
    return x + SubgraphIONodeBase.roundedRadius
  }

  protected override dragNewLink(
    linkConnector: LinkConnector,
    slot: SubgraphOutput
  ): void {
    linkConnector.dragNewFromSubgraphOutput(this.subgraph, this, slot)
  }

  /** @inheritdoc */
  override renameSlot(slot: SubgraphOutput, name: string): void {
    this.subgraph.renameOutput(slot, name)
  }

  /** @inheritdoc */
  override removeSlot(slot: SubgraphOutput): void {
    this.subgraph.removeOutput(slot)
  }

  canConnectTo(
    outputNode: NodeLike,
    fromSlot: SubgraphOutput,
    output: INodeOutputSlot | SubgraphIO
  ): boolean {
    return outputNode.canConnectTo(this, fromSlot, output)
  }

  connectByTypeOutput(
    slot: number,
    target_node: LGraphNode,
    target_slotType: ISlotType,
    optsIn?: { afterRerouteId?: RerouteId }
  ): LLink | undefined {
    const outputSlot = target_node.findOutputByType(target_slotType)
    if (!outputSlot) return

    return this.slots[slot].connect(
      outputSlot.slot,
      target_node,
      optsIn?.afterRerouteId
    )
  }

  findInputByType(type: ISlotType): SubgraphOutput | undefined {
    return findFreeSlotOfType(
      this.slots,
      type,
      (slot) => slot.linkIds.length > 0
    )?.slot
  }

  override drawProtected(
    ctx: CanvasRenderingContext2D,
    colorContext: DefaultConnectionColors,
    fromSlot?:
      | INodeInputSlot
      | INodeOutputSlot
      | SubgraphInput
      | SubgraphOutput,
    editorAlpha?: number
  ): void {
    const { roundedRadius } = SubgraphIONodeBase
    const transform = ctx.getTransform()

    const [x, y, , height] = this.boundingRect
    ctx.translate(x, y)

    // Draw bottom rounded part
    ctx.strokeStyle = this.sideStrokeStyle
    ctx.lineWidth = this.sideLineWidth
    ctx.beginPath()
    ctx.arc(roundedRadius, roundedRadius, roundedRadius, Math.PI, Math.PI * 1.5)

    // Straight line to bottom
    ctx.moveTo(0, roundedRadius)
    ctx.lineTo(0, height - roundedRadius)

    // Bottom rounded part
    ctx.arc(
      roundedRadius,
      height - roundedRadius,
      roundedRadius,
      Math.PI,
      Math.PI * 0.5,
      true
    )
    ctx.stroke()

    // Restore context
    ctx.setTransform(transform)

    this.drawSlots(ctx, colorContext, fromSlot, editorAlpha)
  }
}

function isSubgraphOutput(slot: unknown): slot is SubgraphOutput {
  return (
    slot != null &&
    typeof slot === 'object' &&
    'parent' in slot &&
    slot.parent instanceof SubgraphOutputNode
  )
}

provideSubgraphOutputGuard(isSubgraphOutput)

type RegisteredSubgraphOutputNode = SubgraphOutputNode

declare module '@comfyorg/graph-model/entityRegistry' {
  interface SubgraphOutputNode extends RegisteredSubgraphOutputNode {}
}
