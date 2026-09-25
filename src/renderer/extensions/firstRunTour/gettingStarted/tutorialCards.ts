/** The templates the Getting Started grid offers, in order. */
export const CURATED_TEMPLATE_IDS = [
  'image_krea2_turbo_t2i',
  'image_z_image_turbo',
  'video_ltx2_3_i2v',
  'video_wan2_2_14B_i2v'
] as const

/** Fills the grid, in order, when a curated template is missing from the data. */
export const FALLBACK_TEMPLATE_IDS = [
  'templates-image_to_real',
  'image_qwen_image_edit_2509',
  'flux_fill_inpaint_example',
  'video_ltx2_i2v_distilled'
] as const

export const TUTORIAL_BADGE_ICON = 'icon-[lucide--graduation-cap]'

export interface TutorialCard {
  id: string
  titleKey: string
  url: string
  thumbnail: string
}

export const tutorialCards: readonly TutorialCard[] = [
  {
    id: 'interface-overview',
    titleKey: 'gettingStarted.tutorials.interfaceOverview',
    url: 'https://docs.comfy.org/interface/overview',
    thumbnail: '/assets/images/tutorials/interface-overview.webp'
  },
  {
    id: 'text-to-image',
    titleKey: 'gettingStarted.tutorials.textToImage',
    url: 'https://docs.comfy.org/tutorials/basic/text-to-image',
    thumbnail: '/assets/images/tutorials/text-to-image.webp'
  },
  {
    id: 'image-to-image',
    titleKey: 'gettingStarted.tutorials.imageToImage',
    url: 'https://docs.comfy.org/tutorials/basic/image-to-image',
    thumbnail: '/assets/images/tutorials/image-to-image.webp'
  },
  {
    id: 'inpaint',
    titleKey: 'gettingStarted.tutorials.inpaint',
    url: 'https://docs.comfy.org/tutorials/basic/inpaint',
    thumbnail: '/assets/images/tutorials/inpaint.webp'
  }
]
