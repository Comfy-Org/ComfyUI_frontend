import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Announcement page for a model that has not shipped yet (see the header
// comment in templates/model-launch/types.ts): overlay hero with a
// placeholder still, no gallery/pricing/faq/closingCta. Swap in the full
// config on launch day, the same way /wan-3.0 is built out today.
const chatgptImage25HeroPlaceholderSrc =
  '/images/models/chatgpt-image-2-5-placeholder.jpg'

export const chatgptImage25Page: ModelLaunchPage = {
  metaTitleKey: 'chatgptImage25.meta.title',
  metaDescriptionKey: 'chatgptImage25.meta.description',
  breadcrumbLabelKey: 'chatgptImage25.breadcrumb.model',
  breadcrumbUpdatedKey: 'chatgptImage25.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    placeholderImageSrc: chatgptImage25HeroPlaceholderSrc,
    eyebrowKey: 'chatgptImage25.hero.eyebrow',
    titleKey: 'chatgptImage25.hero.title',
    descriptionKey: 'chatgptImage25.hero.description',
    primaryCta: {
      labelKey: 'chatgptImage25.hero.primaryCta',
      href: externalLinks.cloudCta('chatgpt_image_2_5_announcement'),
      target: '_blank'
    }
  },
  runOptions: {
    headingKey: 'chatgptImage25.runOptions.heading',
    subtitleKey: 'chatgptImage25.runOptions.subtitle',
    ctaKey: 'chatgptImage25.runOptions.cta'
  },
  reviews: {
    headingKey: 'chatgptImage25.reviews.heading',
    highlight: {
      titleKey: 'chatgptImage25.reviews.highlightTitle',
      descriptionKey: 'chatgptImage25.reviews.highlightDescription',
      ctaKey: 'chatgptImage25.reviews.highlightCta'
    }
  }
}
