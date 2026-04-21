import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  supportsVirtualCanvasImagePreview
} from '@/composables/node/canvasImagePreviewTypes'

export { CANVAS_IMAGE_PREVIEW_WIDGET }

type PartialNode = Pick<LGraphNode, 'title' | 'id' | 'type'>

export type WidgetItem = [PartialNode, IBaseWidget]

/** Known non-$$ preview widget types added by core or popular extensions. */
const PREVIEW_WIDGET_TYPES = new Set(['preview', 'video', 'audioUI'])

/**
 * Returns true for pseudo-widgets that display media previews and should
 * be auto-promoted when their node is inside a subgraph.
 * Matches the core `$$` convention as well as custom-node patterns
 * (e.g. VHS `videopreview` with type `"preview"`).
 */
export function isPreviewPseudoWidget(widget: IBaseWidget): boolean {
  if (widget.name.startsWith('$$')) return true
  // Custom nodes may set serialize on the widget or in options
  if (widget.serialize !== false && widget.options?.serialize !== false)
    return false
  if (typeof widget.type === 'string' && PREVIEW_WIDGET_TYPES.has(widget.type))
    return true
  return false
}

const recommendedNodes = [
  'CLIPTextEncode',
  'LoadImage',
  'SaveImage',
  'PreviewImage'
]
const recommendedWidgetNames = ['seed']
export function isRecommendedWidget([node, widget]: WidgetItem) {
  return (
    !widget.computedDisabled &&
    (recommendedNodes.includes(node.type) ||
      recommendedWidgetNames.includes(widget.name))
  )
}

function supportsVirtualPreviewWidget(node: LGraphNode): boolean {
  return supportsVirtualCanvasImagePreview(node)
}

function createVirtualCanvasImagePreviewWidget(): IBaseWidget {
  return {
    name: CANVAS_IMAGE_PREVIEW_WIDGET,
    type: 'IMAGE_PREVIEW',
    options: { serialize: false },
    serialize: false,
    y: 0,
    computedDisabled: false
  }
}

export function getPromotableWidgets(node: LGraphNode): IBaseWidget[] {
  const widgets = [...(node.widgets ?? [])]

  const hasCanvasPreviewWidget = widgets.some(
    (widget) => widget.name === CANVAS_IMAGE_PREVIEW_WIDGET
  )
  const supportsVirtualPreview = supportsVirtualPreviewWidget(node)
  if (!hasCanvasPreviewWidget && supportsVirtualPreview) {
    widgets.push(createVirtualCanvasImagePreviewWidget())
  }

  return widgets
}
