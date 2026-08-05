import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Flux 3 has not launched yet, so this page announces it and holds the URL.
// When the model ships, fill in the gallery, pricing, FAQ and closing CTA the
// way /minimax does; no new components are needed.
export const flux3Page: ModelLaunchPage = {
  metaTitleKey: 'flux3.meta.title',
  metaDescriptionKey: 'flux3.meta.description',
  breadcrumbLabelKey: 'flux3.breadcrumb.model',
  breadcrumbUpdatedKey: 'flux3.breadcrumb.updated',
  hero: {
    eyebrowKey: 'flux3.hero.eyebrow',
    titleKey: 'flux3.hero.title',
    primaryCta: {
      labelKey: 'flux3.hero.primaryCta',
      href: externalLinks.cloud,
      target: '_blank'
    },
    badgeKeys: ['flux3.hero.tagPartnerNodes', 'flux3.hero.tagImageToVideo']
  },
  runOptions: {
    headingKey: 'flux3.runOptions.heading',
    subtitleKey: 'flux3.runOptions.subtitle',
    ctaKey: 'flux3.runOptions.cta'
  },
  reviews: {
    headingKey: 'flux3.reviews.heading',
    highlight: {
      titleKey: 'flux3.reviews.highlightTitle',
      descriptionKey: 'flux3.reviews.highlightDescription',
      ctaKey: 'flux3.reviews.highlightCta'
    }
  }
}
