import { app } from '@/scripts/app'

const CANVAS_IMAGE_PREVIEW_NODES = new Set([
  'PreviewImage',
  'SaveImage',
  'GLSLShader'
])

app.registerExtension({
  name: 'Comfy.CanvasImagePreview',
  beforeRegisterNodeDef(_nodeType, nodeData) {
    if (CANVAS_IMAGE_PREVIEW_NODES.has(nodeData.name)) {
      nodeData.canvas_image_preview = true
    }
  }
})
