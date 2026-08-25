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
// day.

export interface ModelLaunchCta {
  labelKey: TranslationKey
  href: string
  target?: AnchorHTMLAttributes['target']
}

// The prompt bar above the hero video: a sample prompt and a link into the
// workflow that produced it.
interface ModelLaunchPromptBar {
  sampleKey: TranslationKey
  cta: ModelLaunchCta
}

export interface ModelLaunchHero {
  videoSrc?: string
  posterSrc?: string
  // Still stand-in for the hero frame, for pages announcing a model whose
  // launch footage does not exist yet. Ignored once videoSrc is set.
  placeholderImageSrc?: string
  // Still shown instead of the video below the 768px breakpoint, so phones
  // never fetch videoSrc. Opt-in: pages that omit it keep playing the video
  // at every viewport size, as they did before this field existed.
  mobileFallbackImageSrc?: string
  // Lightweight encode played below the 768px breakpoint in place of videoSrc,
  // for pages whose full clip is too heavy for phones. Once the client mounts
  // it wins over mobileFallbackImageSrc, which keeps covering SSR and the
  // first client tick.
  mobileVideoSrc?: string
  // 'content-first' puts the badges, heading, CTAs and prompt bar above the
  // video. 'media-first' leads with the video, which is how /minimax reads.
  // 'overlay' centres the eyebrow, heading and CTAs on top of the media behind
  // a scrim, which is how the announcement pages are designed.
  layout?: 'media-first' | 'content-first' | 'overlay'
  promptBar?: ModelLaunchPromptBar
  // Small label above the heading on announcement pages, e.g. COMING SOON.
  eyebrowKey?: TranslationKey
  // Brand mark drawn as a CSS mask over the top-right corner of the video.
  logoSrc?: string
  titleKey: TranslationKey
  // Rendered muted directly after `titleKey`, for the two-tone Figma heading.
  titleRestKey?: TranslationKey
  descriptionKey?: TranslationKey
  // Optional so a hero can render as title + description + badges only.
  primaryCta?: ModelLaunchCta
  secondaryCta?: ModelLaunchCta
  badgeKeys?: readonly TranslationKey[]
}

type ModelLaunchTier = 'free' | 'premium'

// The gallery defers its videos until the section nears the viewport, so a
// video card renders as an empty box until its file arrives. Give every video a
// `posterSrc` to avoid that; only /flux-3 omits them, until its posters reach
// the CDN.
export type ModelLaunchMedia =
  | { kind: 'video'; src: string; posterSrc?: string }
  | { kind: 'image'; src: string }

interface ModelLaunchGalleryCard {
  id: string
  name: LocalizedText
  tier: ModelLaunchTier
  note: LocalizedText
  description: LocalizedText
  // The prompt that produced the clip. Cards that have one also offer a copy
  // button; cards still waiting on copy simply omit it.
  prompt?: LocalizedText
  media: ModelLaunchMedia
  // Brand mark drawn over the card, for pages whose gallery mixes models.
  logoSrc?: string
  href: string
}

export interface ModelLaunchGallery {
  headingKey: TranslationKey
  // 'accent' paints the per-card link solid yellow. Defaults to the muted
  // treatment /minimax ships, so opting in cannot restyle a live page.
  ctaVariant?: 'muted' | 'accent'
  cards: readonly ModelLaunchGalleryCard[]
}

// Audio launches (e.g. MiniMax Music 3) swap the video gallery for listening
// cards: a still poster with an AudioPlayer over it, the track description, and
// the prompt that produced it. Each track lists its sources MP3-first so the
// page stays light; the browser plays the first it supports.
export interface ModelLaunchAudioCard {
  id: string
  description: LocalizedText
  prompt: LocalizedText
  audioSources: readonly { src: string; type: string }[]
  posterSrc: string
}

export interface ModelLaunchAudioGallery {
  cards: readonly ModelLaunchAudioCard[]
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
  subtitleKey?: TranslationKey
  primaryCta: ModelLaunchCta
  secondaryCta?: ModelLaunchCta
}

interface ModelLaunchStep {
  id: string
  title: LocalizedText
  description: LocalizedText
}

export interface ModelLaunchSteps {
  headingKey: TranslationKey
  stepLabelKey: TranslationKey
  items: readonly ModelLaunchStep[]
  primaryCta?: ModelLaunchCta
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

// The optional body sections, in the order they render between the hero and the
// run-options footer. hero/runOptions/reviews are fixed and are not listed here.
export type ModelLaunchSection =
  | 'gallery'
  | 'audioGallery'
  | 'steps'
  | 'pricing'
  | 'faq'
  | 'closingCta'

// The order the video launch pages shipped with; audioGallery slots in beside
// the video gallery so audio-first pages get a sensible default too. A page
// reorders its sections with `sectionOrder` rather than editing the template,
// so one page's layout never moves another's.
export const DEFAULT_SECTION_ORDER: readonly ModelLaunchSection[] = [
  'gallery',
  'audioGallery',
  'pricing',
  'faq',
  'steps',
  'closingCta'
]

export interface ModelLaunchPage {
  metaTitleKey: TranslationKey
  metaDescriptionKey: TranslationKey
  breadcrumbLabelKey: TranslationKey
  breadcrumbUpdatedKey: TranslationKey
  hero: ModelLaunchHero
  // Absent on announcement pages, which render hero, run options and reviews
  // only until the model ships.
  gallery?: ModelLaunchGallery
  audioGallery?: ModelLaunchAudioGallery
  pricing?: ModelLaunchPricing
  faq?: ModelLaunchFaqSection
  steps?: ModelLaunchSteps
  // Pages that end on a steps CTA row do not need a separate closing CTA.
  closingCta?: ModelLaunchClosingCta
  // Reorders the optional body sections for this page only. Defaults to
  // DEFAULT_SECTION_ORDER. Only sections the page defines render, so listing an
  // absent one is a harmless no-op; a defined section left off the list will
  // not render, which the modelLaunchPages test guards against.
  sectionOrder?: readonly ModelLaunchSection[]
  runOptions: ModelLaunchRunOptions
  reviews: ModelLaunchReviews
}
