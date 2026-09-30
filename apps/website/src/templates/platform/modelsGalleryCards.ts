import type { UseCase } from '../../config/models-catalogue'
import type { TranslationKey } from '../../i18n/site'

export interface GalleryMedia {
  src: string
  posterSrc?: string
  trackSrc?: string
}

type ModelsGalleryCardBase = {
  titleKey: TranslationKey
  badgeIcon: string
  media: GalleryMedia[]
}

/**
 * A card with no Models page of its own carries none of these fields; a
 * card that links to one carries all three, so the link always names the
 * specific use case it demonstrates. `href` is this card's model's
 * canonical `/hub/models/[slug]` page for that use case (the same lookup
 * `model-page.ts` uses) resolved ahead of time, since this file's cards
 * ship to the browser and can't import the server-only Router catalogue
 * that resolves it (see `ModelsApiGallery.test.ts`, which checks `href`
 * against that catalogue). A Router API `{provider}/{model}` id can have a
 * Models page per use case (Gemini Omni 1.1 Flash has three), so `modelId`
 * alone cannot say which page a card means.
 */
export type ModelsGalleryCard = ModelsGalleryCardBase &
  (
    | { modelId: string; useCase: UseCase; href: string }
    | { modelId?: undefined; useCase?: undefined; href?: undefined }
  )

const SEEDANCE_BASE = 'https://media.comfy.org/website/seedance-2.5'
const AI_MODELS_BASE = 'https://media.comfy.org/website/cloud/ai-models'

export const modelsGalleryCards: ModelsGalleryCard[] = [
  {
    titleKey: 'cloud.aiModels.card.seedance25',
    badgeIcon: '/icons/ai-models/bytedance.svg',
    modelId: 'byteplus/dreamina-seedance-2-5-260628',
    useCase: 'generate-videos',
    href: '/hub/models/seedance-2-5-text-to-video/',
    media: [
      {
        src: `${SEEDANCE_BASE}/city.webm`,
        posterSrc: `${SEEDANCE_BASE}/city-poster.webp`
      },
      {
        src: `${SEEDANCE_BASE}/balloons.webm`,
        posterSrc: `${SEEDANCE_BASE}/balloons-poster.webp`
      },
      {
        src: `${SEEDANCE_BASE}/shark.webm`,
        posterSrc: `${SEEDANCE_BASE}/shark-poster.webp`
      }
    ]
  },
  {
    titleKey: 'cloud.aiModels.card.nanoBananaPro',
    badgeIcon: '/icons/ai-models/gemini.svg',
    modelId: 'vertexai/gemini-3-pro-image',
    useCase: 'generate-images',
    href: '/hub/models/nano-banana-pro-text-to-image/',
    media: [{ src: `${AI_MODELS_BASE}/nano-banana-pro.webp` }]
  },
  {
    titleKey: 'cloud.aiModels.card.chatgptImages25',
    badgeIcon: '/icons/ai-models/openai.svg',
    modelId: 'openai/gpt-image-2.5-flare',
    useCase: 'generate-images',
    href: '/hub/models/gpt-image-2-5-flare-text-to-image/',
    media: [
      {
        src: `${AI_MODELS_BASE}/gpt-image-2.webm`,
        trackSrc: `${AI_MODELS_BASE}/gpt-image-2.vtt`
      }
    ]
  },
  {
    titleKey: 'cloud.aiModels.card.klingAi30',
    badgeIcon: '/icons/ai-models/kling.svg',
    modelId: 'kling/kling-3.0-turbo',
    useCase: 'generate-videos',
    href: '/hub/models/kling-3-0-turbo-text-to-video/',
    media: [
      {
        src: 'https://media.comfy.org/website/router/kling-3-video.webp'
      }
    ]
  },
  {
    titleKey: 'cloud.aiModels.card.flux3',
    badgeIcon: '/icons/ai-models/bfl.svg',
    modelId: 'bfl/flux-3-video',
    useCase: 'generate-videos',
    href: '/hub/models/flux-3-video-text-to-video/',
    media: [
      {
        src: 'https://media.comfy.org/website/router/flux-3-t2v.webp'
      }
    ]
  },
  {
    titleKey: 'cloud.aiModels.card.geminiOmniFlash',
    badgeIcon: '/icons/ai-models/gemini.svg',
    modelId: 'gemini/omni-1.1-flash',
    useCase: 'animate-images',
    href: '/hub/models/gemini-omni-1-1-flash-image-to-video/',
    media: [
      {
        src: 'https://media.comfy.org/website/gemini-omni/card-1.webm',
        posterSrc: 'https://media.comfy.org/website/gemini-omni/card-1.webp'
      }
    ]
  }
]
