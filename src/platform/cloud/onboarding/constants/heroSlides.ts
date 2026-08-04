import heroPoster1 from '@/platform/cloud/onboarding/assets/videos/hero-1.webp'
import heroVideo1 from '@/platform/cloud/onboarding/assets/videos/hero-1.webm'
import heroPoster2 from '@/platform/cloud/onboarding/assets/videos/hero-2.webp'
import heroVideo2 from '@/platform/cloud/onboarding/assets/videos/hero-2.webm'
import heroPoster3 from '@/platform/cloud/onboarding/assets/videos/hero-3.webp'
import heroVideo3 from '@/platform/cloud/onboarding/assets/videos/hero-3.webm'

/** Resolves to an `icon-[comfy--*]` class, all safelisted in the design system. */
type Provider = 'gemini' | 'openai' | 'kling' | 'bytedance'

export interface HeroSlide {
  readonly id: string
  /** Model name — a proper noun, deliberately not an i18n key. */
  readonly title: string
  readonly provider: Provider
  readonly src: string
  readonly poster: string
  /** Must match the bundled file: a wrong type makes the browser skip the source. */
  readonly mimeType: string
}

export const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: 'nano-banana-pro',
    title: 'Nano Banana Pro',
    provider: 'gemini',
    src: heroVideo1,
    poster: heroPoster1,
    mimeType: 'video/webm'
  },
  {
    id: 'seedream-4',
    title: 'Seedream 4',
    provider: 'bytedance',
    src: heroVideo2,
    poster: heroPoster2,
    mimeType: 'video/webm'
  },
  {
    id: 'kling-2-5',
    title: 'Kling 2.5',
    provider: 'kling',
    src: heroVideo3,
    poster: heroPoster3,
    mimeType: 'video/webm'
  }
]

export const PROVIDER_ICON: Record<Provider, string> = {
  gemini: 'icon-mask-[comfy--gemini]',
  openai: 'icon-mask-[comfy--openai]',
  kling: 'icon-mask-[comfy--kling]',
  bytedance: 'icon-mask-[comfy--bytedance]'
}
