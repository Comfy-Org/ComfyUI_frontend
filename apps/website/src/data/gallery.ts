import type { CSSProperties } from 'vue'

export interface GalleryItem {
  id: string
  image?: string
  video?: string
  title: string
  userAlias: string
  teamAlias: string
  tool: string
  href?: string
  objectPosition?: CSSProperties['objectPosition']
  objectFit?: CSSProperties['objectFit']
}
