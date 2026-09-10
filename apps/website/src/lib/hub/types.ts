type HubMediaType = 'image' | 'video' | 'audio' | '3d'
type ThumbnailVariant =
  | 'compareSlider'
  | 'hoverDissolve'
  | 'zoomHover'
  | 'hoverZoom'

export interface HubTemplate {
  readonly name: string
  readonly title: string
  readonly mediaType: HubMediaType
  readonly mediaSubtype?: string
  readonly tags: readonly string[]
  readonly models: readonly string[]
  readonly logos: readonly { provider: string | string[] }[]
  readonly usage: number
  readonly date: string
  readonly thumbnails: readonly string[]
  readonly username: string
  readonly isApp: boolean
  readonly thumbnailVariant?: ThumbnailVariant
}
