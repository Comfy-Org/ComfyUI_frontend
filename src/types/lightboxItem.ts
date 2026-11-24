export interface LightboxImageItem {
  readonly kind: 'image'
  readonly url: string
  readonly alt?: string
}

export interface LightboxVideoItem {
  readonly kind: 'video'
  readonly url: string
  readonly mimeType?: string
  /** Played instead of `url` when VideoHelperSuite advanced previews are on. */
  readonly advancedPreviewUrl?: string
}

export interface LightboxAudioItem {
  readonly kind: 'audio'
  readonly url: string
}

export interface LightboxTextItem {
  readonly kind: 'text'
  readonly url: string
  /** Shown instead of fetching `url` when already loaded. */
  readonly content?: string
}

export type LightboxItem =
  | LightboxImageItem
  | LightboxVideoItem
  | LightboxAudioItem
  | LightboxTextItem
