import type { AiModelCard } from '../../components/product/shared/aiModelCards'

// Recent lineup for /cli. The Gemini Omni Flash 1.1 card art is a Gemini
// generation made with the CLI, staged at website/cli/ until real
// Omni Flash output ships; the model itself needs a claims check before
// launch (not yet in the template or partner catalog).
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
    imageSrc: 'https://media.comfy.org/website/cli/omni-flash-card.webp',
    badgeIcon: '/icons/ai-models/gemini.svg'
  },
  {
    titleKey: 'cloud.aiModels.card.nanoBananaPro',
    imageSrc:
      'https://media.comfy.org/website/cloud/ai-models/nano-banana-pro.webp',
    badgeIcon: '/icons/ai-models/gemini.svg'
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
