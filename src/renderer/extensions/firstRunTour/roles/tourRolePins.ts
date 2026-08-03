import type { CURATED_TEMPLATE_IDS } from '../gettingStarted/curatedTemplates'

export type SupportedTemplateId = (typeof CURATED_TEMPLATE_IDS)[number]

export type TourMediaKind = 'image' | 'video'

export interface RolePin {
  id: number
  type: string
}

export interface RolePins {
  source?: RolePin
  prompt?: RolePin
  sink: RolePin
}

export const TOUR_ROLE_PINS: Record<SupportedTemplateId, RolePins> = {
  image_krea2_turbo_t2i: {
    prompt: { id: 19, type: 'PrimitiveStringMultiline' },
    sink: { id: 29, type: 'SaveImage' }
  },
  image_z_image_turbo: {
    prompt: { id: 27, type: 'CLIPTextEncode' },
    sink: { id: 9, type: 'SaveImage' }
  },
  video_ltx2_3_i2v: {
    source: { id: 269, type: 'LoadImage' },
    prompt: { id: 319, type: 'PrimitiveStringMultiline' },
    sink: { id: 75, type: 'SaveVideo' }
  },
  video_wan2_2_14B_i2v: {
    source: { id: 97, type: 'LoadImage' },
    prompt: { id: 93, type: 'CLIPTextEncode' },
    sink: { id: 108, type: 'SaveVideo' }
  }
}
