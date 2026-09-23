import type { TranslationKey } from '../../i18n/translations'

export interface GalleryMedia {
  src: string
  posterSrc?: string
  trackSrc?: string
}

export interface ModelsGalleryCard {
  titleKey: TranslationKey
  badgeIcon: string
  media: GalleryMedia[]
  /**
   * The Router API's `{provider}/{model}` id (the same id
   * `router-providers.ts` sends to `POST /v2/models/{provider}/{model}`).
   * When set, the card links to that model's `/models/[slug]` page; the
   * route resolves it through the same `id.replace('/', '--')` alias the
   * Router content pipeline already builds (see `workshop-browse-content.ts`).
   * Omitted for a model with no Models page of its own.
   */
  modelId?: string
}

/** Builds a `/models/[slug]` href from a Router API `{provider}/{model}` id. */
export function modelGalleryHref(modelId: string): string {
  return `/models/${modelId.replace('/', '--')}/`
}

const SEEDANCE_BASE = 'https://media.comfy.org/website/seedance-2.5'
const AI_MODELS_BASE = 'https://media.comfy.org/website/cloud/ai-models'

export const modelsGalleryCards: ModelsGalleryCard[] = [
  {
    titleKey: 'cloud.aiModels.card.seedance25',
    badgeIcon: '/icons/ai-models/bytedance.svg',
    modelId: 'byteplus/dreamina-seedance-2-5-260628',
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
    media: [{ src: `${AI_MODELS_BASE}/nano-banana-pro.webp` }]
  },
  {
    titleKey: 'cloud.aiModels.card.chatgptImages25',
    badgeIcon: '/icons/ai-models/openai.svg',
    modelId: 'openai/gpt-image-2.5-flare',
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
    media: [
      {
        src: 'https://media.comfy.org/website/router/flux-3-t2v.webp'
      }
    ]
  }
]
