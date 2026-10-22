import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useExtensionService } from '@/services/extensionService'

const NODE_CLASS = 'TextOverlay'
const TEXT_OVERLAY_PREVIEW_WIDGET_NAME = '$$text_overlay_preview'
const MIN_WIDTH = 360
const MIN_HEIGHT = 560

useExtensionService().registerExtension({
  name: 'Comfy.TextOverlay',

  nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== NODE_CLASS) return

    const widget = node.addWidget(
      'textoverlaypreview',
      TEXT_OVERLAY_PREVIEW_WIDGET_NAME,
      null,
      () => {},
      { serialize: false }
    )
    widget.serialize = false

    const [width, height] = node.size
    node.setSize([Math.max(width, MIN_WIDTH), Math.max(height, MIN_HEIGHT)])
  }
})
