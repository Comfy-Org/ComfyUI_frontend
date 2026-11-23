export const CANVAS_IMAGE_PREVIEW_WIDGET = '$$canvas-image-preview'
export const ANIM_PREVIEW_WIDGET = '$$comfy_animation_preview'
export const VIDEO_PREVIEW_WIDGET = 'video-preview'

const MEDIA_PREVIEW_WIDGETS = new Set([
  CANVAS_IMAGE_PREVIEW_WIDGET,
  ANIM_PREVIEW_WIDGET,
  VIDEO_PREVIEW_WIDGET
])

export function isMediaPreviewWidgetName(name: string): boolean {
  return MEDIA_PREVIEW_WIDGETS.has(name)
}

/** The name a preview exposure addresses `node`'s preview `name` by: one name for every image, animation, or video preview, and a nested host's exposure names unchanged. */
export function previewSourceName(
  node: { isSubgraphNode(): boolean } | undefined,
  name: string
): string {
  if (node?.isSubgraphNode() || !isMediaPreviewWidgetName(name)) return name
  return CANVAS_IMAGE_PREVIEW_WIDGET
}
