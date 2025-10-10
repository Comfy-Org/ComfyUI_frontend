/**
 * Media types for Asset Library
 */

export type MediaKind = 'video' | 'audio' | 'image' | '3D'

export type AssetContext = {
  type: 'input' | 'output'
  outputCount?: number // Only for output context
}

export interface AssetMeta {
  id: string
  name: string
  kind: MediaKind
  size: number
  timestamp: number
  thumbnailUrl?: string
  src: string // Actual media URL for video/audio/image types
  jobId?: string // Only for output context
  duration?: number // For video/audio
  isMulti?: boolean // indicates multiple files grouped as one
  dimensions?: {
    width: number
    height: number
  }
}
