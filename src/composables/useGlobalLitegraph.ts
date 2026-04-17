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
    LiteGraph: typeof LiteGraph
    LGraph: typeof LGraph
    LLink: typeof LLink
    LGraphNode: typeof LGraphNode
    LGraphGroup: typeof LGraphGroup
    DragAndScale: typeof DragAndScale
    LGraphCanvas: typeof LGraphCanvas
    ContextMenu: typeof ContextMenu
    LGraphBadge: typeof LGraphBadge
  }
}

/**
 * Assign all properties of LiteGraph to window to make it backward compatible.
 */
export const useGlobalLitegraph = () => {
  window['LiteGraph'] = LiteGraph
  window['LGraph'] = LGraph
  window['LLink'] = LLink
  window['LGraphNode'] = LGraphNode
  window['LGraphGroup'] = LGraphGroup
  window['DragAndScale'] = DragAndScale
  window['LGraphCanvas'] = LGraphCanvas
  window['ContextMenu'] = ContextMenu
  window['LGraphBadge'] = LGraphBadge
}
