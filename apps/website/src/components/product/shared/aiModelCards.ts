import type { TranslationKey } from '../../../i18n/translations'

export interface AiModelCard {
  titleKey: TranslationKey
  imageSrc: string
  badgeIcon: string
  /** Descriptions track for .webm sources; omit when no .vtt exists. */
  trackSrc?: string
}

const AI_MODELS_BASE = 'https://media.comfy.org/website/cloud/ai-models'

function cloudClip(name: string): Pick<AiModelCard, 'imageSrc' | 'trackSrc'> {
  return {
    imageSrc: `${AI_MODELS_BASE}/${name}.webm`,
    trackSrc: `${AI_MODELS_BASE}/${name}.vtt`
  }
}

/** The download-page lineup; pages can pass their own via the cards prop. */
export const defaultAiModelCards: AiModelCard[] = [
  {
    titleKey: 'cloud.aiModels.card.seedance20',
    ...cloudClip('seedance-20'),
    badgeIcon: '/icons/ai-models/bytedance.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.nanoBananaPro',
    imageSrc: `${AI_MODELS_BASE}/nano-banana-pro.webp`,
    badgeIcon: '/icons/ai-models/gemini.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.grokImagine',
    ...cloudClip('grok-video'),
    badgeIcon: '/icons/ai-models/grok.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.qwenImageEdit',
    imageSrc: `${AI_MODELS_BASE}/qwen-image-edit.webp`,
    badgeIcon: '/icons/ai-models/qwen.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.wan22TextToVideo',
    ...cloudClip('wan-22'),
    badgeIcon: '/icons/ai-models/wan.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.gptImage2',
    ...cloudClip('gpt-image-2'),
    badgeIcon: '/icons/ai-models/openai.svg'
  }
]
