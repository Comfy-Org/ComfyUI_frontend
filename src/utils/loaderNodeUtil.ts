/**
 * Utilities for detecting and configuring loader nodes
 * Used by both job menu and media asset actions to determine
 * which loader node type to add to the canvas
 */

import { getMediaTypeFromFilename } from '@comfyorg/shared-frontend-utils/formatUtil'

export const CORE_MEDIA_LOADER_WIDGET_NAMES = {
  LoadAudio: 'audio',
  LoadImage: 'image',
  LoadVideo: 'file'
} as const

export type CoreMediaLoaderClass = keyof typeof CORE_MEDIA_LOADER_WIDGET_NAMES
type CoreMediaLoaderWidgetName =
  (typeof CORE_MEDIA_LOADER_WIDGET_NAMES)[CoreMediaLoaderClass]

export function isCoreMediaLoaderClass(
  value: string
): value is CoreMediaLoaderClass {
  return Object.hasOwn(CORE_MEDIA_LOADER_WIDGET_NAMES, value)
}

/**
 * Detect loader node type from filename extension
 * Uses shared formatUtil for consistent file type detection across the codebase
 *
 * @param filename The filename to check
 * @returns Object with nodeType and widgetName, or nulls if unsupported
 *
 * @example
 * detectNodeTypeFromFilename('image.png') // { nodeType: 'LoadImage', widgetName: 'image' }
 * detectNodeTypeFromFilename('video.mp4') // { nodeType: 'LoadVideo', widgetName: 'file' }
 * detectNodeTypeFromFilename('audio.mp3') // { nodeType: 'LoadAudio', widgetName: 'audio' }
 */
export function detectNodeTypeFromFilename(filename: string): {
  nodeType: CoreMediaLoaderClass | null
  widgetName: CoreMediaLoaderWidgetName | null
} {
  const mediaType = getMediaTypeFromFilename(filename)

  switch (mediaType) {
    case 'image':
      return {
        nodeType: 'LoadImage',
        widgetName: CORE_MEDIA_LOADER_WIDGET_NAMES.LoadImage
      }
    case 'video':
      return {
        nodeType: 'LoadVideo',
        widgetName: CORE_MEDIA_LOADER_WIDGET_NAMES.LoadVideo
      }
    case 'audio':
      return {
        nodeType: 'LoadAudio',
        widgetName: CORE_MEDIA_LOADER_WIDGET_NAMES.LoadAudio
      }
    default:
      // 3D and other types don't have loader nodes
      return { nodeType: null, widgetName: null }
  }
}
