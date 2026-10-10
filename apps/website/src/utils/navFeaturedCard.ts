import type { NavFeatured } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'

const NAV_FEATURED_CARD_IMAGE_FLAG_PREFIX = 'nav-featured-card-image'

const CONTROL_VARIANT = 'control'

export type NavFeaturedCardEventProperties = {
  /** Stable id of the promo placement, for example `gemini-omni`. */
  placement: string
  /** Stable id of the dropdown holding the card, for example `products`. */
  dropdown: string
  href: string
  /** The image variant actually rendered; `control` when none applies. */
  variant: string
  locale: Locale
}

export type NavFeaturedMedia = {
  variant: string
  imageSrc: string
  videoSrc?: string
  imageAlt?: string
}

/**
 * Picks the media to render for a flag answer. Anything that is not the key
 * of a configured variant (no flag, still loading, `control`, a key marketing
 * has not supplied images for) resolves to the control card, so the page
 * never depends on PostHog being reachable.
 */
export function resolveFeaturedMedia(
  featured: NavFeatured,
  flagValue: unknown
): NavFeaturedMedia {
  const { variants } = featured
  if (
    typeof flagValue === 'string' &&
    flagValue !== CONTROL_VARIANT &&
    variants &&
    Object.hasOwn(variants, flagValue)
  ) {
    const { imageSrc, videoSrc, imageAlt } = variants[flagValue]
    return {
      variant: flagValue,
      imageSrc,
      videoSrc,
      // A variant never inherits the control video, which would hide its image.
      imageAlt: imageAlt ?? featured.imageAlt
    }
  }
  return {
    variant: CONTROL_VARIANT,
    imageSrc: featured.imageSrc,
    videoSrc: featured.videoSrc,
    imageAlt: featured.imageAlt
  }
}

/**
 * Each placement has its own multivariate PostHog flag, so its image test is
 * bucketed and read independently of the other promo cards. Create
 * `nav-featured-card-image-<placement>` in the PostHog project (prod 204330)
 * with variant keys that match the keys of that card's `variants`; the
 * `control` arm is the card as authored in `mainNavigation.ts`.
 */
export function getFeaturedImageFlagKey(featured: NavFeatured): string {
  return `${NAV_FEATURED_CARD_IMAGE_FLAG_PREFIX}-${getFeaturedPlacement(featured)}`
}

/** The explicit `analyticsId`, else the path of the link without its locale. */
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
  variant,
  locale
}: {
  featured: NavFeatured
  dropdown: string
  variant: string
  locale: Locale
}): NavFeaturedCardEventProperties {
  return {
    placement: getFeaturedPlacement(featured),
    dropdown,
    href: featured.cta.href,
    variant,
    locale
  }
}
