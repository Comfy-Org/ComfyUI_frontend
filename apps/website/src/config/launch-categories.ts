import type { TranslationKey } from '../i18n/translations'

/**
 * The five shelves the launch spec reads the workflows half through, apart
 * from the workflows themselves: a page that only needs to name a shelf pays
 * for these five rows rather than for the whole catalogue.
 */
export interface LaunchCategoryName {
  readonly key: string
  readonly labelKey: TranslationKey
}

export const LAUNCH_CATEGORY_NAMES: readonly LaunchCategoryName[] = [
  { key: 'videos', labelKey: 'workshop.launch.videos' },
  { key: 'characters', labelKey: 'workshop.launch.characters' },
  { key: 'product', labelKey: 'workshop.launch.product' },
  { key: 'upscale', labelKey: 'workshop.launch.upscale' },
  { key: 'cleanup', labelKey: 'workshop.launch.cleanup' }
]
