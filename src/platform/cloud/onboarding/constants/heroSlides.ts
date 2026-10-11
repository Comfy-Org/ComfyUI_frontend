/** Hero carousel media on media.comfy.org (gs://comfy-org-videos/website/cloud/onboarding). */
const HERO_MEDIA = 'https://media.comfy.org/website/cloud/onboarding'

/** Resolves to an `icon-[comfy--*]` class, all safelisted in the design system. */
type Provider = 'gemini' | 'openai' | 'kling' | 'bytedance'

export interface HeroSlide {
  readonly id: string
  /** Model name — a proper noun, deliberately not an i18n key. */
  readonly title: string
  readonly provider: Provider
  readonly src: string
  readonly poster: string
  /** Must match the served file: a wrong type makes the browser skip the source. */
  readonly mimeType: string
}

export const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: 'nano-banana-pro',
    title: 'Nano Banana Pro',
    provider: 'gemini',
    src: `${HERO_MEDIA}/hero-1.webm`,
    poster: `${HERO_MEDIA}/hero-1.webp`,
    mimeType: 'video/webm'
  },
  {
    id: 'seedream-4',
    title: 'Seedream 4',
    provider: 'bytedance',
    src: `${HERO_MEDIA}/hero-2.webm`,
    poster: `${HERO_MEDIA}/hero-2.webp`,
    mimeType: 'video/webm'
  },
  {
    id: 'kling-2-5',
    title: 'Kling 2.5',
    provider: 'kling',
    src: `${HERO_MEDIA}/hero-3.webm`,
    poster: `${HERO_MEDIA}/hero-3.webp`,
    mimeType: 'video/webm'
  }
]

export const PROVIDER_ICON: Record<Provider, string> = {
  gemini: 'icon-mask-[comfy--gemini]',
  openai: 'icon-mask-[comfy--openai]',
  kling: 'icon-mask-[comfy--kling]',
  bytedance: 'icon-mask-[comfy--bytedance]'
}
