import type { TranslationKey } from '../../i18n/translations'

interface BrandAsset {
  id: string
  titleKey: TranslationKey
  download?: string
  preview?: string
  comingSoon?: boolean
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
    id: 'banner-leaderboard',
    titleKey: 'affiliate-landing.assets.tile.banner-leaderboard.title',
    comingSoon: true
  },
  {
    id: 'banner-medium-rectangle',
    titleKey: 'affiliate-landing.assets.tile.banner-medium-rectangle.title',
    comingSoon: true
  },
  {
    id: 'banner-skyscraper',
    titleKey: 'affiliate-landing.assets.tile.banner-skyscraper.title',
    comingSoon: true
  },
  {
    id: 'banner-social',
    titleKey: 'affiliate-landing.assets.tile.banner-social.title',
    comingSoon: true
  }
]
