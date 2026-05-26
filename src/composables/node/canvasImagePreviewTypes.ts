import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

export const CANVAS_IMAGE_PREVIEW_WIDGET = '$$canvas-image-preview'
const CANVAS_IMAGE_PREVIEW_NODE_TYPES = new Set([
  'PreviewImage',
  'SaveImage',
  'GLSLShader',
  'LoadImage',
  'LoadVideo'
])

export function supportsVirtualCanvasImagePreview(node: LGraphNode): boolean {
  return CANVAS_IMAGE_PREVIEW_NODE_TYPES.has(node.type)
}
