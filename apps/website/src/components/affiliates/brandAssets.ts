import type { TranslationKey } from '../../i18n/translations'

interface BrandAsset {
  id: string
  titleKey: TranslationKey
  download: string
  preview: string
}

export const brandAssets: BrandAsset[] = [
  {
    id: 'logo-horizontal',
    titleKey: 'affiliate-landing.assets.tile.logo-horizontal.title',
    download: '/icons/logo.svg',
    preview: '/icons/logo.svg'
  },
  {
    id: 'logomark',
    titleKey: 'affiliate-landing.assets.tile.logomark.title',
    download: '/icons/logomark.svg',
    preview: '/icons/logomark.svg'
  },
  {
    id: 'comfy-full-logo-yellow',
    titleKey: 'affiliate-landing.assets.tile.comfy-full-logo-yellow.title',
    download: '/affiliates/brand/comfy-full-logo-yellow.svg',
    preview: '/affiliates/brand/comfy-full-logo-yellow.svg'
  },
  {
    id: 'comfy-full-logo-ink',
    titleKey: 'affiliate-landing.assets.tile.comfy-full-logo-ink.title',
    download: '/affiliates/brand/comfy-full-logo-ink.svg',
    preview: '/affiliates/brand/comfy-full-logo-ink.svg'
  },
  {
    id: 'amplified-logo-mark',
    titleKey: 'affiliate-landing.assets.tile.amplified-logo-mark.title',
    download: '/affiliates/brand/comfy-amplified-logo-mark.svg',
    preview: '/affiliates/brand/comfy-amplified-logo-mark.svg'
  },
  {
    id: 'dimensional-logo-mark',
    titleKey: 'affiliate-landing.assets.tile.dimensional-logo-mark.title',
    download: '/affiliates/brand/comfy-dimensional-logo-mark.svg',
    preview: '/affiliates/brand/comfy-dimensional-logo-mark.svg'
  },
  {
    id: 'color-combo-yellow',
    titleKey: 'affiliate-landing.assets.tile.color-combo-yellow.title',
    download: '/affiliates/brand/comfy-color-combo-yellow.svg',
    preview: '/affiliates/brand/comfy-color-combo-yellow.svg'
  },
  {
    id: 'color-combo-ink',
    titleKey: 'affiliate-landing.assets.tile.color-combo-ink.title',
    download: '/affiliates/brand/comfy-color-combo-ink.svg',
    preview: '/affiliates/brand/comfy-color-combo-ink.svg'
  }
]
