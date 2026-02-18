/**
 * Utilities for detecting and configuring loader nodes
 * Used by both job menu and media asset actions to determine
 * which loader node type to add to the canvas
 */

import { getMediaTypeFromFilename } from '@comfyorg/shared-frontend-utils/formatUtil'

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
 * detectNodeTypeFromFilename('model.glb') // { nodeType: 'Load3D', widgetName: 'model_file' }
 */
export function detectNodeTypeFromFilename(filename: string): {
  nodeType: 'LoadImage' | 'LoadVideo' | 'LoadAudio' | 'Load3D' | null
  widgetName: 'image' | 'file' | 'audio' | 'model_file' | null
} {
  const mediaType = getMediaTypeFromFilename(filename)

  switch (mediaType) {
    case 'image':
      return { nodeType: 'LoadImage', widgetName: 'image' }
    case 'video':
      return { nodeType: 'LoadVideo', widgetName: 'file' }
    case 'audio':
      return { nodeType: 'LoadAudio', widgetName: 'audio' }
    case '3D':
      return { nodeType: 'Load3D', widgetName: 'model_file' }
    default:
      // Other unsupported media types don't have loader nodes
      return { nodeType: null, widgetName: null }
  }
}
