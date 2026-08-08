import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'
import { COMING_SOON_HERO } from './comingSoonHero'

// Wan Animate 2 has not shipped yet, so this page announces it and holds the URL.
// On launch day, replace this config with the full one the way /flux-3 did; the
// page stubs and the template stay as they are.
export const wanAnimate2Page: ModelLaunchPage = {
  metaTitleKey: 'wanAnimate2.meta.title',
  metaDescriptionKey: 'wanAnimate2.meta.description',
  breadcrumbLabelKey: 'wanAnimate2.breadcrumb.model',
  breadcrumbUpdatedKey: 'wanAnimate2.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    placeholderImageSrc: COMING_SOON_HERO,
    eyebrowKey: 'wanAnimate2.hero.eyebrow',
    titleKey: 'wanAnimate2.hero.title',
    primaryCta: {
      labelKey: 'wanAnimate2.hero.primaryCta',
      href: externalLinks.cloud,
      target: '_blank'
    }
  },
  runOptions: {
    headingKey: 'wanAnimate2.runOptions.heading',
    subtitleKey: 'wanAnimate2.runOptions.subtitle',
    ctaKey: 'wanAnimate2.runOptions.cta'
  },
  reviews: {
    headingKey: 'wanAnimate2.reviews.heading',
    highlight: {
      titleKey: 'wanAnimate2.reviews.highlightTitle',
      descriptionKey: 'wanAnimate2.reviews.highlightDescription',
      ctaKey: 'wanAnimate2.reviews.highlightCta'
    }
  }
}
