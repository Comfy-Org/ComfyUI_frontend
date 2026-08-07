import type { AnchorHTMLAttributes } from 'vue'

import type { getRoutes } from '../../config/routes'
import type { BillingCycle } from '../../data/pricingPlans'
import type { LocalizedText, TranslationKey } from '../../i18n/translations'

// Shape of a model-launch landing page (comfy.org/minimax was the first one).
// To add the next launch page: export one of these from `src/data/<model>.ts`,
// add the `<model>.*` translation keys it points at, and add two page stubs
// (`pages/<model>.astro` + `pages/zh-CN/<model>.astro`) that hand the config to
// ModelLaunchPage.astro. No new components should be needed.
//
// An announcement page for a model that has not shipped is the same config with
// less in it: give the hero `layout: 'overlay'` and a `placeholderImageSrc`,
// omit gallery/pricing/faq/closingCta, and swap in the full config on launch
// day. `src/data/seedance.ts` is the worked example.

interface ModelLaunchCta {
  labelKey: TranslationKey
  href: string
  target?: AnchorHTMLAttributes['target']
}

export interface ModelLaunchHero {
  videoSrc?: string
  // Still stand-in for the hero frame, for pages announcing a model whose
  // launch footage does not exist yet. Ignored once videoSrc is set.
  placeholderImageSrc?: string
  // 'overlay' centres the eyebrow, heading and CTAs on top of the media behind
  // a scrim, which is how the announcement pages are designed. Launch pages
  // keep 'stacked', where the media sits above the text.
  layout?: 'stacked' | 'overlay'
  // Small label above the heading, e.g. NEW.
  eyebrowKey?: TranslationKey
  // Brand mark drawn as a CSS mask over the top-right corner of the video.
  logoSrc?: string
  titleKey: TranslationKey
  // Rendered muted directly after `titleKey`, for the two-tone Figma heading.
  titleRestKey?: TranslationKey
  descriptionKey?: TranslationKey
  primaryCta: ModelLaunchCta
  secondaryCta?: ModelLaunchCta
  badgeKeys?: readonly TranslationKey[]
  footnoteKey?: TranslationKey
}

type ModelLaunchTier = 'free' | 'premium'

interface ModelLaunchGalleryCard {
  id: string
  name: LocalizedText
  tier: ModelLaunchTier
  note: LocalizedText
  description: LocalizedText
  mediaSrc: string
  href: string
}

export interface ModelLaunchGallery {
  headingKey: TranslationKey
  cards: readonly ModelLaunchGalleryCard[]
}

interface ModelLaunchPricingBanner {
  titleKey: TranslationKey
  subtitleKey: TranslationKey
  cta: ModelLaunchCta
}

export interface ModelLaunchPricing {
  banner?: ModelLaunchPricingBanner
  defaultBillingCycle?: BillingCycle
}

interface ModelLaunchFaq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

export interface ModelLaunchFaqSection {
  headingKey: TranslationKey
  items: readonly ModelLaunchFaq[]
}

export interface ModelLaunchClosingCta {
  headingKey: TranslationKey
  primaryCta: ModelLaunchCta
  secondaryCta?: ModelLaunchCta
}

export interface ModelLaunchRunOptions {
  headingKey: TranslationKey
  subtitleKey: TranslationKey
  ctaKey: TranslationKey
}

export interface ModelLaunchReviews {
  headingKey: TranslationKey
  // The promo card above the testimonials. It points at /mcp unless a page
  // names another route to cross-sell.
  highlight: {
    titleKey: TranslationKey
    descriptionKey: TranslationKey
    ctaKey: TranslationKey
    route?: keyof ReturnType<typeof getRoutes>
  }
}

export interface ModelLaunchPage {
  metaTitleKey: TranslationKey
  metaDescriptionKey: TranslationKey
  breadcrumbLabelKey: TranslationKey
  breadcrumbUpdatedKey: TranslationKey
  hero: ModelLaunchHero
  // Everything below the hero is optional: a page announcing a model that has
  // not shipped yet has no gallery, pricing, FAQ or closing CTA to show.
  gallery?: ModelLaunchGallery
  pricing?: ModelLaunchPricing
  faq?: ModelLaunchFaqSection
  closingCta?: ModelLaunchClosingCta
  runOptions: ModelLaunchRunOptions
  reviews: ModelLaunchReviews
}
