import type { LocalizedText } from '../i18n/translations'

import { externalLinks } from '../config/routes'

// Placeholder media reused from existing hosted cloud assets so the page
// renders end-to-end. Swap for the final Seedance renders and provider logos
// from June before launch (CRE-145).
const media = {
  hero: 'https://media.comfy.org/website/cloud/ai-models/seedance-20.webm',
  example1:
    'https://media.comfy.org/website/cloud/ai-models/nano-banana-pro.webp',
  example2:
    'https://media.comfy.org/website/cloud/ai-models/qwen-image-edit.webp',
  kling: 'https://media.comfy.org/website/cloud/ai-models/grok-video.webm',
  wan: 'https://media.comfy.org/website/cloud/ai-models/wan-22.webm',
  veo: 'https://media.comfy.org/website/cloud/ai-models/seedance-20.webm',
  hailuo: 'https://media.comfy.org/website/cloud/ai-models/gpt-image-2.webm'
} as const

export const seedanceHeroVideo = media.hero

export interface SeedanceStep {
  id: string
  title: LocalizedText
  description: LocalizedText
  imageSrc: string
}

export const seedanceSteps: readonly SeedanceStep[] = [
  {
    id: 'write-the-shot',
    title: { en: 'Write the shot', 'zh-CN': '写下镜头' },
    description: {
      en: 'Camera, subject, framing',
      'zh-CN': '镜头、主体、构图'
    },
    imageSrc: media.example1
  },
  {
    id: 'draft-on-wan',
    title: { en: 'Draft free on Wan 2.2', 'zh-CN': '用 Wan 2.2 免费打样' },
    description: {
      en: 'Same workflow, zero credits',
      'zh-CN': '相同工作流，零积分消耗'
    },
    imageSrc: media.example2
  },
  {
    id: 'switch-to-seedance',
    title: { en: 'Switch to Seedance 2.5', 'zh-CN': '切换到 Seedance 2.5' },
    description: {
      en: 'Final render, up to 4K',
      'zh-CN': '最终渲染，最高 4K'
    },
    imageSrc: media.example1
  }
] as const

export type SeedanceModelTier = 'free' | 'premium'

export interface SeedanceModel {
  id: string
  name: string
  tier: SeedanceModelTier
  note: LocalizedText
  description: LocalizedText
  imageSrc: string
  logoSrc: string
  logoAlt: string
  href: string
}

// Six cards in a 2x3 grid to match the Figma (which repeats Veo/Hailuo as the
// last two). June to supply the final roster + card art.
export const seedanceModels: readonly SeedanceModel[] = [
  {
    id: 'kling-3',
    name: 'Kling 3.0',
    tier: 'free',
    note: { en: 'Pay-as-you-go', 'zh-CN': '按量付费' },
    description: {
      en: 'Precise camera and motion control.',
      'zh-CN': '精准的镜头与运动控制。'
    },
    imageSrc: media.kling,
    logoSrc: '/icons/ai-models/bytedance.svg',
    logoAlt: 'Kling',
    href: externalLinks.workflows
  },
  {
    id: 'wan-22',
    name: 'Wan 2.2',
    tier: 'free',
    note: { en: 'Included free', 'zh-CN': '免费包含' },
    description: {
      en: 'Draft free before you spend a credit.',
      'zh-CN': '在消耗积分前免费打样。'
    },
    imageSrc: media.wan,
    logoSrc: '/icons/ai-models/wan.svg',
    logoAlt: 'Wan',
    href: externalLinks.workflows
  },
  {
    id: 'veo-31',
    name: 'Veo 3.1',
    tier: 'premium',
    note: { en: 'Pay-as-you-go', 'zh-CN': '按量付费' },
    description: {
      en: 'Native audio with the frame.',
      'zh-CN': '画面自带原生音频。'
    },
    imageSrc: media.veo,
    logoSrc: '/icons/ai-models/gemini.svg',
    logoAlt: 'Veo',
    href: externalLinks.workflows
  },
  {
    id: 'hailuo',
    name: 'Hailuo',
    tier: 'premium',
    note: { en: 'Pay-as-you-go', 'zh-CN': '按量付费' },
    description: {
      en: 'Fast, expressive character motion.',
      'zh-CN': '快速且富有表现力的角色动作。'
    },
    imageSrc: media.hailuo,
    logoSrc: '/icons/ai-models/bytedance.svg',
    logoAlt: 'Hailuo',
    href: externalLinks.workflows
  },
  {
    id: 'veo-31-b',
    name: 'Veo 3.1',
    tier: 'premium',
    note: { en: 'Pay-as-you-go', 'zh-CN': '按量付费' },
    description: {
      en: 'Native audio with the frame.',
      'zh-CN': '画面自带原生音频。'
    },
    imageSrc: media.veo,
    logoSrc: '/icons/ai-models/gemini.svg',
    logoAlt: 'Veo',
    href: externalLinks.workflows
  },
  {
    id: 'hailuo-b',
    name: 'Hailuo',
    tier: 'premium',
    note: { en: 'Pay-as-you-go', 'zh-CN': '按量付费' },
    description: {
      en: 'Fast, expressive character motion.',
      'zh-CN': '快速且富有表现力的角色动作。'
    },
    imageSrc: media.hailuo,
    logoSrc: '/icons/ai-models/bytedance.svg',
    logoAlt: 'Hailuo',
    href: externalLinks.workflows
  }
] as const

export interface SeedanceExample {
  id: string
  prompt: LocalizedText
  imageSrc: string
  imageAlt: LocalizedText
}

// Prompt/result pairs are placeholder pending June's final examples.
export const seedanceExamples: readonly SeedanceExample[] = [
  {
    id: 'dalmatian-loft',
    prompt: {
      en: 'A dalmatian stretches across a sunlit loft, slow push-in, shallow depth of field, warm morning light.',
      'zh-CN':
        '一只斑点狗在洒满阳光的阁楼里舒展身体，镜头缓缓推进，浅景深，温暖的晨光。'
    },
    imageSrc: media.example1,
    imageAlt: {
      en: 'Seedance render of a dalmatian in a sunlit loft',
      'zh-CN': 'Seedance 渲染的阁楼斑点狗画面'
    }
  },
  {
    id: 'city-window',
    prompt: {
      en: 'Handheld shot drifting past a rain-streaked city window at dusk, neon reflections, cinematic grade.',
      'zh-CN':
        '黄昏时分，手持镜头掠过雨痕斑驳的城市窗户，霓虹倒影，电影级调色。'
    },
    imageSrc: media.example2,
    imageAlt: {
      en: 'Seedance render of a rain-streaked city window at dusk',
      'zh-CN': 'Seedance 渲染的黄昏雨窗画面'
    }
  },
  {
    id: 'studio-portrait',
    prompt: {
      en: 'Slow orbit around a model on a seamless studio backdrop, soft key light, subtle rim, editorial motion.',
      'zh-CN':
        '镜头缓缓环绕纯色背景前的模特，柔和主光，微妙轮廓光，时尚编辑感的运镜。'
    },
    imageSrc: media.veo,
    imageAlt: {
      en: 'Seedance render of a studio portrait orbit',
      'zh-CN': 'Seedance 渲染的影棚人像环绕画面'
    }
  },
  {
    id: 'street-tracking',
    prompt: {
      en: 'Tracking shot following a runner through a neon night market, shallow focus, motion blur, moody grade.',
      'zh-CN': '跟拍镜头追随一名跑者穿过霓虹夜市，浅焦，动态模糊，情绪化调色。'
    },
    imageSrc: media.kling,
    imageAlt: {
      en: 'Seedance render of a runner in a neon night market',
      'zh-CN': 'Seedance 渲染的霓虹夜市跑者画面'
    }
  }
] as const

export interface SeedanceFaq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

// FAQ questions follow the Figma; answers drafted from the page content
// pending June/Nav sign-off (CRE-145).
export const seedanceFaqs: readonly SeedanceFaq[] = [
  {
    id: 'cost-to-run',
    question: {
      en: 'How much does Seedance 2.5 cost to run?',
      'zh-CN': '运行 Seedance 2.5 的费用是多少？'
    },
    answer: {
      en: 'Seedance runs on pay-as-you-go credits or subscription credits — and you can draft the same shot free on Wan 2.2 before spending anything. No watermark either way.',
      'zh-CN':
        'Seedance 采用按量付费积分或订阅积分，你可以先在 Wan 2.2 上免费打样同一镜头，再决定是否消耗积分。两种方式都不带水印。'
    }
  },
  {
    id: 'generate-4k',
    question: {
      en: 'Can Seedance 2.5 generate 4K video?',
      'zh-CN': 'Seedance 2.5 能生成 4K 视频吗？'
    },
    answer: {
      en: 'Yes. Seedance 2.5 renders up to 4K, with multi-shot sequences directed on the Comfy canvas.',
      'zh-CN':
        '可以。Seedance 2.5 最高支持 4K 渲染，并可在 Comfy 画布上执导多镜头序列。'
    }
  },
  {
    id: 'text-or-image',
    question: {
      en: 'Text to video or image to video?',
      'zh-CN': '是文生视频还是图生视频？'
    },
    answer: {
      en: 'Both. Start from a text prompt or drop in a reference image; you direct the shot either way.',
      'zh-CN':
        '两者都支持。你可以从文本提示开始，也可以放入参考图像，无论哪种方式都由你执导镜头。'
    }
  },
  {
    id: 'clip-length',
    question: {
      en: 'How long can clips be?',
      'zh-CN': '片段可以多长？'
    },
    answer: {
      en: 'Seedance 2.5 builds multi-shot sequences, so you stack shots and direct the full cut on the canvas rather than being capped at a single clip.',
      'zh-CN':
        'Seedance 2.5 可构建多镜头序列，你可以在画布上叠加镜头并执导完整成片，而不局限于单个片段。'
    }
  },
  {
    id: 'commercial-use',
    question: {
      en: 'Can I use the videos commercially?',
      'zh-CN': '视频可以商用吗？'
    },
    answer: {
      en: 'Yes. Renders include commercial use and carry no watermark.',
      'zh-CN': '可以。渲染结果包含商业使用授权，且不带水印。'
    }
  },
  {
    id: 'seedance-vs-kling',
    question: {
      en: 'Seedance vs Kling — which one for my shot?',
      'zh-CN': 'Seedance 与 Kling，我的镜头该选哪个？'
    },
    answer: {
      en: 'Kling gives precise camera and motion control; Seedance is built for multi-shot cinematic sequences. Draft on Wan 2.2, then finish on whichever the shot demands.',
      'zh-CN':
        'Kling 提供精准的镜头与运动控制，Seedance 专为多镜头电影级序列打造。先用 Wan 2.2 打样，再根据镜头需求选择合适的模型完成。'
    }
  }
] as const
