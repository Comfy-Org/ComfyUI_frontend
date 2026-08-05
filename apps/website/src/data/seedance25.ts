import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Seedance 2.5 has not launched yet, so this page announces it and holds the
// URL. When the model ships, fill in the gallery, pricing, FAQ and closing
// CTA the way /minimax does; no new components are needed.
export const seedance25Page: ModelLaunchPage = {
  metaTitleKey: 'seedance25.meta.title',
  metaDescriptionKey: 'seedance25.meta.description',
  breadcrumbLabelKey: 'seedance25.breadcrumb.model',
  breadcrumbUpdatedKey: 'seedance25.breadcrumb.updated',
  hero: {
    eyebrowKey: 'seedance25.hero.eyebrow',
    titleKey: 'seedance25.hero.title',
    primaryCta: {
      labelKey: 'seedance25.hero.primaryCta',
      href: externalLinks.cloud,
      target: '_blank'
    },
    badgeKeys: [
      'seedance25.hero.tagPartnerNode',
      'seedance25.hero.tagVideoGeneration'
    ]
  },
  runOptions: {
    headingKey: 'seedance25.runOptions.heading',
    subtitleKey: 'seedance25.runOptions.subtitle',
    ctaKey: 'seedance25.runOptions.cta'
  },
  reviews: {
    headingKey: 'seedance25.reviews.heading',
    highlight: {
      titleKey: 'seedance25.reviews.highlightTitle',
      descriptionKey: 'seedance25.reviews.highlightDescription',
      ctaKey: 'seedance25.reviews.highlightCta'
    }
  }
}
