import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

export const CANVAS_IMAGE_PREVIEW_WIDGET = '$$canvas-image-preview'

export function supportsVirtualCanvasImagePreview(node: LGraphNode): boolean {
  return (
    (node.constructor as typeof LGraphNode).nodeData?.canvas_image_preview ===
    true
  )
}
