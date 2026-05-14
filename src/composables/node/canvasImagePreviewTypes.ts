import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

export const CANVAS_IMAGE_PREVIEW_WIDGET = '$$canvas-image-preview'

/**
 * Node types that project a `$$canvas-image-preview`. Includes core sampling
 * nodes (KSampler / KSamplerAdvanced) which receive live mid-execution
 * preview images, plus terminal preview nodes (PreviewImage, SaveImage)
 * and shader nodes (GLSLShader).
 */
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
