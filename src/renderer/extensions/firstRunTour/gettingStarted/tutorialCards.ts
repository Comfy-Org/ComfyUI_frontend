/** The templates the Getting Started grid offers, in order. */
export const CURATED_TEMPLATE_IDS = [
  'image_krea2_turbo_t2i',
  'image_z_image_turbo',
  'video_ltx2_3_i2v',
  'video_wan2_2_14B_i2v'
] as const

/** Fills the grid, in order, when a curated template is missing from the data. */
export const FALLBACK_TEMPLATE_IDS = [
  'gsc_advanced_3_2',
  'image_qwen_image_edit_2509',
  'templates-qwen_multiangle.app',
  'gsc_advanced_3_1'
] as const

export const TUTORIAL_BADGE_ICON = 'icon-[lucide--graduation-cap]'

export interface TutorialCard {
  id: string
  titleKey: string
  url: string
  thumbnailTemplate: (typeof CURATED_TEMPLATE_IDS)[number]
}

/**
 * Thumbnails are offset from the Templates tab's order so the two grids don't
 * read as the same four images in the same places.
 */
export const tutorialCards: readonly TutorialCard[] = [
  {
    id: 'interface-overview',
    titleKey: 'gettingStarted.tutorials.interfaceOverview',
    url: 'https://docs.comfy.org/interface/overview',
    thumbnailTemplate: 'image_krea2_turbo_t2i'
  },
  {
    id: 'text-to-image',
    titleKey: 'gettingStarted.tutorials.textToImage',
    url: 'https://docs.comfy.org/tutorials/basic/text-to-image',
    thumbnailTemplate: 'video_ltx2_3_i2v'
  },
  {
    id: 'image-to-image',
    titleKey: 'gettingStarted.tutorials.imageToImage',
    url: 'https://docs.comfy.org/tutorials/basic/image-to-image',
    thumbnailTemplate: 'video_wan2_2_14B_i2v'
  },
  {
    id: 'inpaint',
    titleKey: 'gettingStarted.tutorials.inpaint',
    url: 'https://docs.comfy.org/tutorials/basic/inpaint',
    thumbnailTemplate: 'image_z_image_turbo'
  }
]
