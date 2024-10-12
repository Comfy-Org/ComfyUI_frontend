// @ts-strict-ignore
import type {
  ConnectingLink,
  LGraphNode,
  Vector2,
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot
} from '@comfyorg/litegraph'
import type { ISlotType } from '@comfyorg/litegraph'
import { LiteGraph } from '@comfyorg/litegraph'

export class ConnectingLinkImpl implements ConnectingLink {
  node: LGraphNode
  slot: number
  input: INodeInputSlot | null
  output: INodeOutputSlot | null
  pos: Vector2

  constructor(
    node: LGraphNode,
    slot: number,
    input: INodeInputSlot | null,
    output: INodeOutputSlot | null,
    pos: Vector2
  ) {
    this.node = node
    this.slot = slot
    this.input = input
    this.output = output
    this.pos = pos
  }

  static createFromPlainObject(obj: ConnectingLink) {
    return new ConnectingLinkImpl(
      obj.node,
      obj.slot,
      obj.input,
      obj.output,
      obj.pos
    )
  }

  get type(): ISlotType | null {
    const result = this.input ? this.input.type : this.output.type
    return result === -1 ? null : result
  }

  /**
   * Which slot type is release and need to be reconnected.
   * - 'output' means we need a new node's outputs slot to connect with this link
   */
  get releaseSlotType(): 'input' | 'output' {
    return this.output ? 'input' : 'output'
  }

  connectTo(newNode: LGraphNode) {
    const newNodeSlots =
      this.releaseSlotType === 'output' ? newNode.outputs : newNode.inputs
    if (!newNodeSlots) return

    const newNodeSlot = newNodeSlots.findIndex((slot: INodeSlot) =>
      LiteGraph.isValidConnection(slot.type, this.type)
    )

    if (newNodeSlot === -1) {
      console.warn(
        `Could not find slot with type ${this.type} on node ${newNode.title}. This should never happen`
      )
      return
    }

    if (this.releaseSlotType === 'input') {
      this.node.connect(this.slot, newNode, newNodeSlot)
    } else {
      newNode.connect(newNodeSlot, this.node, this.slot)
    }
  }
}

export type CanvasDragAndDropData<T = any> = {
  type: 'add-node'
  data: T
}
