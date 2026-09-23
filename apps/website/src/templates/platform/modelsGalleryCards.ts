import type { UseCase } from '../../config/models-catalogue'
import { getRouterModelHref } from '../../config/workshop-router-content'
import type { TranslationKey } from '../../i18n/translations'

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
 * A card with no Models page of its own carries neither field; a card that
 * links to one carries both, so the link always names the specific use case
 * it demonstrates. A Router API `{provider}/{model}` id can have a Models
 * page per use case (Gemini Omni 1.1 Flash has three), so `modelId` alone
 * cannot say which page a card means.
 */
export type ModelsGalleryCard = ModelsGalleryCardBase &
  (
    | { modelId: string; useCase: UseCase }
    | { modelId?: undefined; useCase?: undefined }
  )

/**
 * Resolves a Router API `{provider}/{model}` id and use case to that
 * model's canonical `/models/[slug]` href (the same lookup `model-page.ts`
 * uses), so the gallery links directly to the real page rather than to a
 * short slug that would 301-redirect.
 */
export function modelGalleryHref(modelId: string, useCase: UseCase): string {
  const href = getRouterModelHref(modelId, useCase)
  if (!href)
    throw new Error(`Unknown Router model id/use case: ${modelId} (${useCase})`)
  return href
}

const SEEDANCE_BASE = 'https://media.comfy.org/website/seedance-2.5'
const AI_MODELS_BASE = 'https://media.comfy.org/website/cloud/ai-models'

export const modelsGalleryCards: ModelsGalleryCard[] = [
  {
    titleKey: 'cloud.aiModels.card.seedance25',
    badgeIcon: '/icons/ai-models/bytedance.svg',
    modelId: 'byteplus/dreamina-seedance-2-5-260628',
    useCase: 'generate-videos',
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
    media: [{ src: `${AI_MODELS_BASE}/nano-banana-pro.webp` }]
  },
  {
    titleKey: 'cloud.aiModels.card.chatgptImages25',
    badgeIcon: '/icons/ai-models/openai.svg',
    modelId: 'openai/gpt-image-2.5-flare',
    useCase: 'generate-images',
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
    media: [
      {
        src: 'https://media.comfy.org/website/gemini-omni/card-1.webm',
        posterSrc: 'https://media.comfy.org/website/gemini-omni/card-1.webp'
      }
    ]
  }
]
