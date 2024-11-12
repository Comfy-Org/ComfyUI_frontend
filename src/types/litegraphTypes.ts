import type {
  ConnectingLink,
  LGraphNode,
  Vector2,
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot,
  ISlotType
} from '@comfyorg/litegraph'
import { LiteGraph } from '@comfyorg/litegraph'
import { RerouteId } from '@comfyorg/litegraph/dist/Reroute'

export class ConnectingLinkImpl implements ConnectingLink {
  constructor(
    public node: LGraphNode,
    public slot: number,
    public input: INodeInputSlot | undefined,
    public output: INodeOutputSlot | undefined,
    public pos: Vector2,
    public afterRerouteId?: RerouteId
  ) {}

  static createFromPlainObject(obj: ConnectingLink) {
    return new ConnectingLinkImpl(
      obj.node,
      obj.slot,
      obj.input,
      obj.output,
      obj.pos,
      obj.afterRerouteId
    )
  }

  get type(): ISlotType | null {
    const result = this.input ? this.input.type : this.output?.type ?? null
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
      this.node.connect(this.slot, newNode, newNodeSlot, this.afterRerouteId)
    } else {
      newNode.connect(newNodeSlot, this.node, this.slot, this.afterRerouteId)
    }
  }
}

export type CanvasDragAndDropData<T = any> = {
  type: 'add-node'
  data: T
}
