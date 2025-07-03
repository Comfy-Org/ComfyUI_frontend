import type { LGraphEventMap } from "./LGraphEventMap"
import type { INodeInputSlot } from "@/litegraph"
import type { SubgraphInput } from "@/subgraph/SubgraphInput"
import type { IBaseWidget } from "@/types/widgets"

export interface SubgraphInputEventMap extends LGraphEventMap {
  "input-connected": {
    input: INodeInputSlot
    widget: IBaseWidget
  }

  "input-disconnected": {
    input: SubgraphInput
  }
}
