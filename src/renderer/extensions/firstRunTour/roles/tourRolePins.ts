import type {
  CURATED_TEMPLATE_IDS,
  FALLBACK_TEMPLATE_IDS
} from '../gettingStarted/tutorialCards'

/** Every id the Getting Started grid can offer, so no card can ship unpinned. */
export type SupportedTemplateId =
  | (typeof CURATED_TEMPLATE_IDS)[number]
  | (typeof FALLBACK_TEMPLATE_IDS)[number]

export type TourMediaKind = 'image' | 'video'

/** The kind a sink node type produces, so the drift guard can hold the two in step. */
export const MEDIA_KIND_BY_SINK_TYPE: Record<string, TourMediaKind> = {
  SaveImage: 'image',
  SaveVideo: 'video'
}

/**
 * A pinned node. The type is pinned alongside the id so an upstream renumber
 * that leaves the id occupied by a different node fails the drift guard.
 */
export interface RolePin {
  id: number
  type: string
}

export interface RolePins {
  /** Absent for text-to-image, which has nothing to upload. */
  source?: RolePin
  /** Absent when the template exposes no prompt the user can edit. */
  prompt?: RolePin
  sink: RolePin
  mediaKind: TourMediaKind
}

/**
 * The templates the tour supports, pinned by hand. A prompt pinned inside a
 * subgraph is spotlit through the root-graph node hosting it.
 */
export const TOUR_ROLE_PINS: Record<SupportedTemplateId, RolePins> = {
  image_krea2_turbo_t2i: {
    prompt: { id: 19, type: 'PrimitiveStringMultiline' },
    sink: { id: 29, type: 'SaveImage' },
    mediaKind: 'image'
  },
  image_z_image_turbo: {
    prompt: { id: 27, type: 'CLIPTextEncode' },
    sink: { id: 9, type: 'SaveImage' },
    mediaKind: 'image'
  },
  video_ltx2_3_i2v: {
    source: { id: 269, type: 'LoadImage' },
    prompt: { id: 319, type: 'PrimitiveStringMultiline' },
    sink: { id: 75, type: 'SaveVideo' },
    mediaKind: 'video'
  },
  video_wan2_2_14B_i2v: {
    source: { id: 97, type: 'LoadImage' },
    prompt: { id: 93, type: 'CLIPTextEncode' },
    sink: { id: 108, type: 'SaveVideo' },
    mediaKind: 'video'
  },
  'templates-image_to_real': {
    source: { id: 14, type: 'LoadImage' },
    sink: { id: 18, type: 'SaveImage' },
    mediaKind: 'image'
  },
  image_qwen_image_edit_2509: {
    source: { id: 78, type: 'LoadImage' },
    prompt: { id: 435, type: 'PrimitiveStringMultiline' },
    sink: { id: 60, type: 'SaveImage' },
    mediaKind: 'image'
  },
  'templates-qwen_multiangle.app': {
    source: { id: 1, type: 'LoadImage' },
    sink: { id: 2, type: 'SaveImage' },
    mediaKind: 'image'
  },
  video_ltx2_i2v_distilled: {
    source: { id: 98, type: 'LoadImage' },
    prompt: { id: 3, type: 'CLIPTextEncode' },
    sink: { id: 75, type: 'SaveVideo' },
    mediaKind: 'video'
  }
}
