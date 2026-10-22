import type { NavFeatured } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'

const NAV_FEATURED_CARD_IMAGE_FLAG_PREFIX = 'nav-featured-card-image'

const CONTROL_VARIANT = 'control'

export type FlagVariantRead =
  | { state: 'not_loaded' | 'unanswered' | 'no_flag' }
  | { state: 'answered'; key: string }

type VariantSource =
  | 'not_loaded'
  | 'unanswered'
  | 'no_flag'
  | 'control_flag'
  | 'unknown_variant'
  | 'flag'

export type NavFeaturedCardEventProperties = {
  placement: string
  dropdown: string
  href: string
  variant: string
  variant_source: VariantSource
  locale: Locale
}

export type NavFeaturedMedia = {
  variant: string
  variantSource: VariantSource
  imageSrc: string
  videoSrc?: string
  imageAlt?: string
}

export function resolveFeaturedMedia(
  featured: NavFeatured,
  read: FlagVariantRead
): NavFeaturedMedia {
  const control = {
    variant: CONTROL_VARIANT,
    imageSrc: featured.imageSrc,
    videoSrc: featured.videoSrc,
    imageAlt: featured.imageAlt
  }
  if (read.state !== 'answered')
    return { ...control, variantSource: read.state }
  if (read.key === CONTROL_VARIANT)
    return { ...control, variantSource: 'control_flag' }
  const { variants } = featured
  if (!variants || !Object.hasOwn(variants, read.key))
    return { ...control, variantSource: 'unknown_variant' }
  const { imageSrc, videoSrc, imageAlt } = variants[read.key]
  return {
    variant: read.key,
    variantSource: 'flag',
    imageSrc,
    videoSrc,
    imageAlt
  }
}

export function getFeaturedImageFlagKey(featured: NavFeatured): string {
  return `${NAV_FEATURED_CARD_IMAGE_FLAG_PREFIX}-${getFeaturedPlacement(featured)}`
}

export function getFeaturedPlacement(featured: NavFeatured): string {
  if (featured.analyticsId) return featured.analyticsId
  const path = featured.cta.href
    .replace(/[?#].*$/, '')
    .replace(/^\/(zh-CN|ja)(?=\/|$)/, '')
    .replace(/^\/+|\/+$/g, '')
  return path || 'home'
}

export function buildNavFeaturedCardEventProperties({
  featured,
  dropdown,
  media,
  locale
}: {
  featured: NavFeatured
  dropdown: string
  media: Pick<NavFeaturedMedia, 'variant' | 'variantSource'>
  locale: Locale
}): NavFeaturedCardEventProperties {
  return {
    placement: getFeaturedPlacement(featured),
    dropdown,
    href: featured.cta.href,
    variant: media.variant,
    variant_source: media.variantSource,
    locale
  }
}
