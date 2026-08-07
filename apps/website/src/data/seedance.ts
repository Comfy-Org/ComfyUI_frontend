import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'
import { COMING_SOON_HERO } from './comingSoonHero'

// Seedance 2.5 has not shipped yet, so this page announces it and holds the
// URL. On launch day, replace this config with the full one the way /flux-3
// did; the page stubs and the template stay as they are.
export const seedancePage: ModelLaunchPage = {
  metaTitleKey: 'seedance.meta.title',
  metaDescriptionKey: 'seedance.meta.description',
  breadcrumbLabelKey: 'seedance.breadcrumb.model',
  breadcrumbUpdatedKey: 'seedance.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    placeholderImageSrc: COMING_SOON_HERO,
    eyebrowKey: 'seedance.hero.eyebrow',
    titleKey: 'seedance.hero.title',
    primaryCta: {
      labelKey: 'seedance.hero.primaryCta',
      href: externalLinks.cloud,
      target: '_blank'
    }
  },
  runOptions: {
    headingKey: 'seedance.runOptions.heading',
    subtitleKey: 'seedance.runOptions.subtitle',
    ctaKey: 'seedance.runOptions.cta'
  },
  reviews: {
    headingKey: 'seedance.reviews.heading',
    highlight: {
      titleKey: 'seedance.reviews.highlightTitle',
      descriptionKey: 'seedance.reviews.highlightDescription',
      ctaKey: 'seedance.reviews.highlightCta'
    }
  }
}
