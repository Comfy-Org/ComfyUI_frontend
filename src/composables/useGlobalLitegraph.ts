import type { ContextMenu as ContextMenuType } from '@/lib/litegraph/src/ContextMenu'
import type { DragAndScale as DragAndScaleType } from '@/lib/litegraph/src/DragAndScale'
import type { LGraph as LGraphType } from '@/lib/litegraph/src/LGraph'
import type { LGraphBadge as LGraphBadgeType } from '@/lib/litegraph/src/LGraphBadge'
import type { LGraphCanvas as LGraphCanvasType } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphGroup as LGraphGroupType } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode as LGraphNodeType } from '@/lib/litegraph/src/LGraphNode'
import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'
import type { LLink as LLinkType } from '@/lib/litegraph/src/LLink'

import {
  ContextMenu,
  DragAndScale,
  LGraph,
  LGraphBadge,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LLink,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'

declare global {
  interface Window {
    LiteGraph: LiteGraphGlobal
    LGraph: typeof LGraphType
    LLink: typeof LLinkType
    LGraphNode: typeof LGraphNodeType
    LGraphGroup: typeof LGraphGroupType
    DragAndScale: typeof DragAndScaleType
    LGraphCanvas: typeof LGraphCanvasType
    ContextMenu: typeof ContextMenuType
    LGraphBadge: typeof LGraphBadgeType
  }
}

/**
 * Assign all properties of LiteGraph to window to make it backward compatible.
 */
export function useGlobalLitegraph() {
  window.LiteGraph = LiteGraph
  window.LGraph = LGraph
  window.LLink = LLink
  window.LGraphNode = LGraphNode
  window.LGraphGroup = LGraphGroup
  window.DragAndScale = DragAndScale
  window.LGraphCanvas = LGraphCanvas
  window.ContextMenu = ContextMenu
  window.LGraphBadge = LGraphBadge
}
