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
}

const SEEDANCE_BASE = 'https://media.comfy.org/website/seedance-2.5'
const MINIMAX_BASE = 'https://media.comfy.org/website/minimax'
const AI_MODELS_BASE = 'https://media.comfy.org/website/cloud/ai-models'

export const modelsGalleryCards: ModelsGalleryCard[] = [
  {
    titleKey: 'cloud.aiModels.card.seedance25',
    badgeIcon: '/icons/ai-models/bytedance.svg',
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
    titleKey: 'cloud.aiModels.card.minimaxH3',
    badgeIcon: '/icons/ai-models/minimax.svg',
    media: [
      {
        src: 'https://media.comfy.org/website/minimax-h3/hero-dragon-960.webm'
      },
      {
        src: `${MINIMAX_BASE}/ice-rider.webm`,
        posterSrc: `${MINIMAX_BASE}/ice-rider-poster.webp`
      },
      {
        src: `${MINIMAX_BASE}/superhero.webm`,
        posterSrc: `${MINIMAX_BASE}/superhero-poster.webp`
      }
    ]
  },
  {
    titleKey: 'cloud.aiModels.card.nanoBananaPro',
    badgeIcon: '/icons/ai-models/gemini.svg',
    media: [{ src: `${AI_MODELS_BASE}/nano-banana-pro.webp` }]
  },
  {
    titleKey: 'cloud.aiModels.card.gptImage2',
    badgeIcon: '/icons/ai-models/openai.svg',
    media: [
      {
        src: `${AI_MODELS_BASE}/gpt-image-2.webm`,
        trackSrc: `${AI_MODELS_BASE}/gpt-image-2.vtt`
      }
    ]
  }
]
