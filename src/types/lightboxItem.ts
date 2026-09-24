/**
 * Rendering contract for the shared media lightbox.
 *
 * Deliberately free of queue/result-domain fields so callers that only hold a
 * URL (node previews, dropzones, chat attachments) do not have to fabricate
 * identifiers to open the lightbox. Owners of richer records adapt them at
 * their own boundary via `resultItemsToLightboxItems`; URL-only callers use
 * `fileLightboxItem`.
 */
export interface LightboxImageItem {
  readonly kind: 'image'
  readonly url: string
  readonly alt?: string
}

export interface LightboxVideoItem {
  readonly kind: 'video'
  readonly url: string
  readonly mimeType?: string
  /** Preferred source when VideoHelperSuite advanced previews are enabled. */
  readonly advancedPreviewUrl?: string
}

export interface LightboxAudioItem {
  readonly kind: 'audio'
  readonly url: string
}

export interface LightboxTextItem {
  readonly kind: 'text'
  readonly url: string
  /** Inline text, when already loaded; otherwise fetched from `url`. */
  readonly content?: string
}

/**
 * Kept in the union so adapters stay total and indices line up 1:1 with the
 * source records. Renders nothing, matching the previous fallthrough.
 */
interface LightboxUnsupportedItem {
  readonly kind: 'unsupported'
  readonly url: string
}

export type LightboxItem =
  | LightboxImageItem
  | LightboxVideoItem
  | LightboxAudioItem
  | LightboxTextItem
  | LightboxUnsupportedItem
