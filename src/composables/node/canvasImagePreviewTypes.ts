import type { LGraphNode } from '@comfyorg/litegraph/litegraph'

const CANVAS_IMAGE_PREVIEW_NODE_TYPES = new Set([
  'KSampler',
  'KSamplerAdvanced',
  'PreviewImage',
  'SaveImage',
  'GLSLShader'
])

export function supportsVirtualCanvasImagePreview(node: LGraphNode): boolean {
  return CANVAS_IMAGE_PREVIEW_NODE_TYPES.has(node.type)
}
