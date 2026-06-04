import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useExtensionService } from '@/services/extensionService'

const COMFY_CLASS = 'ImageGridSlice'
const PREVIEW_WIDGET_NAME = 'grid_preview'
const PREVIEW_WIDGET_HEIGHT = 200
const MIN_NODE_WIDTH = 320
const MIN_NODE_HEIGHT = 360

function addPreviewWidget(node: LGraphNode) {
  if (node.widgets?.some((w) => w.name === PREVIEW_WIDGET_NAME)) return

  const widget = node.addCustomWidget({
    name: PREVIEW_WIDGET_NAME,
    type: 'imagegridslice',
    value: '',
    options: { serialize: false },
    serialize: false,
    computeSize: () => [0, PREVIEW_WIDGET_HEIGHT]
  } as unknown as IBaseWidget)

  if (node.widgets && node.widgets.at(-1) === widget) {
    node.widgets.pop()
    node.widgets.unshift(widget)
  }
}

useExtensionService().registerExtension({
  name: 'Comfy.ImageGridSlice',

  nodeCreated(node) {
    if (node.constructor.comfyClass !== COMFY_CLASS) return

    const [width, height] = node.size
    node.setSize([
      Math.max(width, MIN_NODE_WIDTH),
      Math.max(height, MIN_NODE_HEIGHT)
    ])

    addPreviewWidget(node)
  }
})
