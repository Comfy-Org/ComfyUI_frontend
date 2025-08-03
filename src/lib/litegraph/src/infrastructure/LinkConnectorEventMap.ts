import type { FloatingRenderLink } from "@/canvas/FloatingRenderLink"
import type { MovingInputLink } from "@/canvas/MovingInputLink"
import type { MovingOutputLink } from "@/canvas/MovingOutputLink"
import type { RenderLink } from "@/canvas/RenderLink"
import type { ToInputFromIoNodeLink } from "@/canvas/ToInputFromIoNodeLink"
import type { ToInputRenderLink } from "@/canvas/ToInputRenderLink"
import type { LGraphNode } from "@/LGraphNode"
import type { LLink } from "@/LLink"
import type { Reroute } from "@/Reroute"
import type { SubgraphInputNode } from "@/subgraph/SubgraphInputNode"
import type { SubgraphOutputNode } from "@/subgraph/SubgraphOutputNode"
import type { CanvasPointerEvent } from "@/types/events"
import type { IWidget } from "@/types/widgets"

export interface LinkConnectorEventMap {
  "reset": boolean

  "before-drop-links": {
    renderLinks: RenderLink[]
    event: CanvasPointerEvent
  }
  "after-drop-links": {
    renderLinks: RenderLink[]
    event: CanvasPointerEvent
  }

  "before-move-input": MovingInputLink | FloatingRenderLink
  "before-move-output": MovingOutputLink | FloatingRenderLink

  "input-moved": MovingInputLink | FloatingRenderLink | ToInputFromIoNodeLink
  "output-moved": MovingOutputLink | FloatingRenderLink

  "link-created": LLink | null | undefined

  "dropped-on-reroute": {
    reroute: Reroute
    event: CanvasPointerEvent
  }
  "dropped-on-node": {
    node: LGraphNode
    event: CanvasPointerEvent
  }
  "dropped-on-io-node": {
    node: SubgraphInputNode | SubgraphOutputNode
    event: CanvasPointerEvent
  }
  "dropped-on-canvas": CanvasPointerEvent

  "dropped-on-widget": {
    link: ToInputRenderLink
    node: LGraphNode
    widget: IWidget
  }
}
