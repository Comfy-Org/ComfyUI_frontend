// @ts-strict-ignore
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
} from '@comfyorg/litegraph'

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
