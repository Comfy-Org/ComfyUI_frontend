import bytedanceIcon from '@comfyorg/design-system/icons/bytedance.svg?url'
import geminiIcon from '@comfyorg/design-system/icons/gemini.svg?url'
import klingIcon from '@comfyorg/design-system/icons/kling.svg?url'

/** Hero carousel media on media.comfy.org (gs://comfy-org-videos/website/cloud/onboarding). */
const HERO_MEDIA = 'https://media.comfy.org/website/cloud/onboarding'

type Provider = 'gemini' | 'kling' | 'bytedance'

export interface HeroSlide {
  readonly id: string
  /** Model name, a proper noun, deliberately not a translation key. */
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

/** Rendered as a currentColor mask, the same treatment as the cloud app's icon-mask utilities. */
export const PROVIDER_ICON: Record<Provider, string> = {
  gemini: geminiIcon,
  kling: klingIcon,
  bytedance: bytedanceIcon
}
