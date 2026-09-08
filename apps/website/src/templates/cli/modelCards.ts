import type { AiModelCard } from '../../components/product/shared/aiModelCards'

// Recent lineup for /cli. Clips come from each model page's own media
// (gemini-omni, seedance-2.5, minimax-h3); wan-3-card.webm is a 7s cut of
// the wan-3.0 page's mobile hero, staged under website/cli/.
export const cliModelCards: AiModelCard[] = [
  {
    titleKey: 'cloud.aiModels.card.seedance25',
    imageSrc: 'https://media.comfy.org/website/seedance-2.5/city.webm',
    badgeIcon: '/icons/ai-models/bytedance.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.minimaxH3',
    imageSrc: 'https://media.comfy.org/website/minimax-h3/hero-dragon-960.webm',
    badgeIcon: '/icons/ai-models/minimax.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.geminiOmniFlash',
    imageSrc: 'https://media.comfy.org/website/gemini-omni/card-1.webm',
    badgeIcon: '/icons/ai-models/gemini.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.wan3',
    imageSrc: 'https://media.comfy.org/website/cli/wan-3-card.webm',
    badgeIcon: '/icons/ai-models/wan.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.wan22TextToVideo',
    imageSrc: 'https://media.comfy.org/website/cloud/ai-models/wan-22.webm',
    trackSrc: 'https://media.comfy.org/website/cloud/ai-models/wan-22.vtt',
    badgeIcon: '/icons/ai-models/wan.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.gptImage2',
    imageSrc:
      'https://media.comfy.org/website/cloud/ai-models/gpt-image-2.webm',
    trackSrc: 'https://media.comfy.org/website/cloud/ai-models/gpt-image-2.vtt',
    badgeIcon: '/icons/ai-models/openai.svg'
  }
]
