import type { ResultItem } from '@/platform/remote/comfyui/execution/types'

export interface NodeImage {
  url: string
  result?: ResultItem
}

export type NodeMedia =
  | { type: 'image'; images: NodeImage[] }
  | { type: 'video' | 'audio'; urls: string[] }
