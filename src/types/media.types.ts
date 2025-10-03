/**
 * Media types for Asset Library
 */

export type MediaKind =
  | 'video'
  | 'webm'
  | 'webp'
  | 'gif'
  | 'audio'
  | 'image'
  | 'pose'
  | 'text'
  | 'other'

export type AssetContext = 'input' | 'output'

export interface AssetMeta {
  id: string
  name: string
  kind: MediaKind
  size: number
  timestamp: number
  thumbnailUrl?: string
  videoUrl?: string // Actual video URL for video types
  jobId?: string // Only for output context
  duration?: number // For video/audio
  isMulti?: boolean // indicates multiple files grouped as one
  dimensions?: {
    width: number
    height: number
  }
}
