import type { ConnectingLink } from "@/interfaces"
import type { LGraphGroup } from "@/LGraphGroup"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasPointerEvent } from "@/types/events"

export interface LGraphCanvasEventMap {
  "litegraph:canvas":
    | { subType: "before-change" | "after-change" }
    | {
      subType: "empty-release"
      originalEvent?: CanvasPointerEvent
      linkReleaseContext?: { links: ConnectingLink[] }
    }
    | {
      subType: "group-double-click"
      originalEvent?: CanvasPointerEvent
      group: LGraphGroup
    }
    | {
      subType: "empty-double-click"
      originalEvent?: CanvasPointerEvent
    }
    | {
      subType: "node-double-click"
      originalEvent?: CanvasPointerEvent
      node: LGraphNode
    }
}
