import type { ConnectingLink } from "@/interfaces"
import type { LGraph } from "@/LGraph"
import type { LGraphButton } from "@/LGraphButton"
import type { LGraphGroup } from "@/LGraphGroup"
import type { LGraphNode } from "@/LGraphNode"
import type { Subgraph } from "@/subgraph/Subgraph"
import type { CanvasPointerEvent } from "@/types/events"

export interface LGraphCanvasEventMap {
  /** The active graph has changed. */
  "litegraph:set-graph": {
    /** The new active graph. */
    newGraph: LGraph | Subgraph
    /** The old active graph, or `null` if there was no active graph. */
    oldGraph: LGraph | Subgraph | null | undefined
  }

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

  /** A title button on a node was clicked. */
  "litegraph:node-title-button-clicked": {
    node: LGraphNode
    button: LGraphButton
  }
}
