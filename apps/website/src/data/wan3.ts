import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'
import { COMING_SOON_HERO } from './comingSoonHero'

// Wan 3.0 has not shipped yet, so this page announces it and holds the URL.
// On launch day, replace this config with the full one the way /flux-3 did; the
// page stubs and the template stay as they are.
export const wan3Page: ModelLaunchPage = {
  metaTitleKey: 'wan3.meta.title',
  metaDescriptionKey: 'wan3.meta.description',
  breadcrumbLabelKey: 'wan3.breadcrumb.model',
  breadcrumbUpdatedKey: 'wan3.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    placeholderImageSrc: COMING_SOON_HERO,
    eyebrowKey: 'wan3.hero.eyebrow',
    titleKey: 'wan3.hero.title',
    primaryCta: {
      labelKey: 'wan3.hero.primaryCta',
      href: externalLinks.cloud,
      target: '_blank'
    }
  },
  runOptions: {
    headingKey: 'wan3.runOptions.heading',
    subtitleKey: 'wan3.runOptions.subtitle',
    ctaKey: 'wan3.runOptions.cta'
  },
  reviews: {
    headingKey: 'wan3.reviews.heading',
    highlight: {
      titleKey: 'wan3.reviews.highlightTitle',
      descriptionKey: 'wan3.reviews.highlightDescription',
      ctaKey: 'wan3.reviews.highlightCta'
    }
  }
}
