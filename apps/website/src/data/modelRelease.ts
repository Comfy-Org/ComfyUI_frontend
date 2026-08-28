import type { getRoutes } from '../config/routes'
import type { TranslationKey } from '../i18n/translations'

type RouteKey = keyof ReturnType<typeof getRoutes>

type ModelReleaseMedia = {
  type: 'image' | 'video'
  src: string
  poster?: string
  /** Accessible name for the slide's media. */
  ariaLabelKey: TranslationKey
}

export type ModelReleaseSlide = {
  id: string
  media: ModelReleaseMedia
  titleKey: TranslationKey
  bodyKey: TranslationKey
  exploreLabelKey: TranslationKey
  /** Locale-aware model page route for the primary CTA. */
  exploreRoute: RouteKey
  tryCta: {
    labelKey: TranslationKey
    href: string
  }
  tagKeys: TranslationKey[]
  /** The hero clip's real duration, so the carousel advances as it ends. */
  autoplayMs: number
}

// Slides for the home page "latest drops" carousel. Hero clips are encoded to
// the site's web video profile and served from media.comfy.org; each poster is
// the clip's own first frame.
export const modelReleaseSlides: ModelReleaseSlide[] = [
  {
    id: 'seedance-2-5',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/seedance-2.5/hero.mp4',
      poster: 'https://media.comfy.org/website/seedance-2.5/hero-poster.webp',
      ariaLabelKey: 'modelRelease.seedance.videoAriaLabel'
    },
    titleKey: 'modelRelease.seedance.title',
    bodyKey: 'modelRelease.seedance.body',
    exploreLabelKey: 'modelRelease.seedance.explore',
    exploreRoute: 'seedance',
    tryCta: {
      labelKey: 'cta.tryWorkflow',
      href: 'https://cloud.comfy.org/?template=api_seedance2_5_r2v'
    },
    tagKeys: ['tags.partnerNodes'],
    autoplayMs: 17500
  },
  {
    id: 'ltx-2-5',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/ltx-2.5/hero.mp4',
      poster: 'https://media.comfy.org/website/ltx-2.5/hero-poster.webp',
      ariaLabelKey: 'modelRelease.ltx.videoAriaLabel'
    },
    titleKey: 'modelRelease.ltx.title',
    bodyKey: 'modelRelease.ltx.body',
    exploreLabelKey: 'modelRelease.ltx.explore',
    exploreRoute: 'ltx',
    tryCta: {
      labelKey: 'cta.tryForFree',
      href: 'https://cloud.comfy.org/?template=video_ltx2_5_i2v'
    },
    tagKeys: ['tags.openSource', 'tags.partnerNodes'],
    autoplayMs: 20500
  },
  {
    id: 'wan-animate-2',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/wan-animate-2/hero.mp4',
      poster: 'https://media.comfy.org/website/wan-animate-2/hero-poster.webp',
      ariaLabelKey: 'modelRelease.wanAnimate2.videoAriaLabel'
    },
    titleKey: 'modelRelease.wanAnimate2.title',
    bodyKey: 'modelRelease.wanAnimate2.body',
    exploreLabelKey: 'modelRelease.wanAnimate2.explore',
    exploreRoute: 'wanAnimate2',
    tryCta: {
      labelKey: 'cta.tryForFree',
      href: 'https://cloud.comfy.org/?template=video_wan_animate2'
    },
    tagKeys: ['tags.openWeights'],
    autoplayMs: 18000
  },
  {
    id: 'minimax-h3',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/minimax/hero.mp4',
      poster: 'https://media.comfy.org/website/minimax/hero-poster.webp',
      ariaLabelKey: 'modelRelease.minimax.videoAriaLabel'
    },
    titleKey: 'modelRelease.minimax.title',
    bodyKey: 'modelRelease.minimax.body',
    exploreLabelKey: 'modelRelease.minimax.explore',
    exploreRoute: 'minimax',
    tryCta: {
      labelKey: 'cta.tryForFree',
      href: 'https://cloud.comfy.org/?share=a781503cf508'
    },
    tagKeys: ['tags.openWeights', 'tags.partnerNodes'],
    autoplayMs: 8500
  }
]
