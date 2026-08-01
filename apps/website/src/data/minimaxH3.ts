import type { LocalizedText } from '../i18n/translations'

import { externalLinks } from '../config/routes'

// PLACEHOLDER MEDIA. The MiniMax H3 renders June linked in the Figma
// (node 9770-37353) are not reachable from this sandbox — the Figma token is
// expired — so every clip below points at an already-hosted asset purely so
// the preview renders. Swap these six URLs for the real
// media.comfy.org/website/minimax-h3/* encodes before launch; nothing else
// needs to change.
const media = {
  hero: 'https://media.comfy.org/website/homepage/showcase/video-showcase.webm',
  textToVideo: 'https://media.comfy.org/website/cloud/ai-models/wan-22.webm',
  imageToVideo:
    'https://media.comfy.org/website/cloud/ai-models/seedance-20.webm',
  referenceToVideo:
    'https://media.comfy.org/website/cloud/ai-models/grok-video.webm'
} as const

export const minimaxH3HeroVideo = media.hero

// Gates both locale pages until the OSS weights are public. Clearing it also
// starts emitting their FAQ structured data, and must be paired with dropping
// /minimax-h3 from SITEMAP_EXCLUDED_PATHNAMES in astro.config.ts.
export const minimaxH3NoindexUntilLaunch = true

// CTA destinations. `runModel` is a stand-in for the launch workflow deep link
// — Rob owns picking which of Lin's workflows the CTA points at, so it lands
// on Comfy Cloud until that URL exists.
export const minimaxH3Ctas = {
  tryForFree: externalLinks.cloudCta('minimax_h3_lp'),
  runModel: externalLinks.cloud,
  workflows: externalLinks.workflows
} as const

export interface MinimaxH3Highlight {
  id: string
  label: LocalizedText
  detail: LocalizedText
}

// Each highlight restates a claim already made in the hero subhead on the
// Figma frame, so nothing here is a new marketing claim.
export const minimaxH3Highlights: readonly MinimaxH3Highlight[] = [
  {
    id: 'open-weights',
    label: { en: 'Open weights', 'zh-CN': '开放权重' },
    detail: {
      en: 'The open release of Hailuo 3.0, runnable locally.',
      'zh-CN': 'Hailuo 3.0 的开源版本，可在本地运行。'
    }
  },
  {
    id: 'resolution',
    label: { en: 'Up to 2K', 'zh-CN': '最高 2K' },
    detail: {
      en: 'Five to fifteen seconds per generation.',
      'zh-CN': '每次生成 5 至 15 秒。'
    }
  },
  {
    id: 'audio',
    label: { en: 'Native stereo', 'zh-CN': '原生立体声' },
    detail: {
      en: 'Sound on every clip, generated in the same pass.',
      'zh-CN': '每段片段都带声音，一次生成同步输出。'
    }
  },
  {
    id: 'multi-modal',
    label: { en: 'Multi-modal I/O', 'zh-CN': '多模态输入输出' },
    detail: {
      en: 'Conditions on input audio instead of overwriting it.',
      'zh-CN': '以输入音频作为条件，而非覆盖或丢弃它。'
    }
  }
] as const

export interface MinimaxH3Workflow {
  id: string
  title: LocalizedText
  description: LocalizedText
  videoSrc: string
  href: string
}

// The three launch workflows Rob confirmed in #gtm-mini-max. Titles and
// descriptions are placeholders until Lin's templates are published — the
// `href` should become each template's permalink at that point.
export const minimaxH3Workflows: readonly MinimaxH3Workflow[] = [
  {
    id: 'text-to-video',
    title: { en: 'Text to video', 'zh-CN': '文本生成视频' },
    description: {
      en: 'Describe the shot and let H3 direct it, audio included.',
      'zh-CN': '描述镜头，让 H3 完成拍摄，并同步生成音频。'
    },
    videoSrc: media.textToVideo,
    href: externalLinks.workflows
  },
  {
    id: 'image-to-video',
    title: { en: 'Image to video', 'zh-CN': '图像生成视频' },
    description: {
      en: 'Bring a still into motion without losing the frame you set.',
      'zh-CN': '让静态画面动起来，同时保留你设定的构图。'
    },
    videoSrc: media.imageToVideo,
    href: externalLinks.workflows
  },
  {
    id: 'reference-to-video',
    title: { en: 'Reference to video', 'zh-CN': '参考图生成视频' },
    description: {
      en: 'Carry a subject or style across every generation.',
      'zh-CN': '在每一次生成中延续同一主体或风格。'
    },
    videoSrc: media.referenceToVideo,
    href: externalLinks.workflows
  }
] as const

export interface MinimaxH3Faq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

// Answers are deliberately limited to facts already public: the open-weights
// release, the specs on the Figma frame, and the existing partner node.
export const minimaxH3Faqs: readonly MinimaxH3Faq[] = [
  {
    id: 'what-is-minimax-h3',
    question: {
      en: 'What is MiniMax H3?',
      'zh-CN': 'MiniMax H3 是什么？'
    },
    answer: {
      en: 'MiniMax H3 is the open release of Hailuo 3.0, a video model with full multi-modal input and output. It generates five to fifteen second clips at up to 2K with native stereo audio in a single pass.',
      'zh-CN':
        'MiniMax H3 是 Hailuo 3.0 的开源版本，是一款支持完整多模态输入输出的视频模型。它可一次性生成 5 至 15 秒、最高 2K 并带原生立体声的片段。'
    }
  },
  {
    id: 'audio-handling',
    question: {
      en: 'How does H3 handle input audio?',
      'zh-CN': 'H3 如何处理输入音频？'
    },
    answer: {
      en: 'H3 conditions on the audio you supply rather than overwriting or discarding it, so a supplied track shapes the generation instead of being replaced by one.',
      'zh-CN':
        'H3 会以你提供的音频作为生成条件，而不是覆盖或丢弃它，因此你的音轨会影响生成结果，而非被替换掉。'
    }
  },
  {
    id: 'where-to-run',
    question: {
      en: 'Where can I run MiniMax H3?',
      'zh-CN': '我可以在哪里运行 MiniMax H3？'
    },
    answer: {
      en: 'Run it on Comfy Cloud with no local GPU, or locally in ComfyUI now that the weights are open. The MiniMax partner node is already available in ComfyUI.',
      'zh-CN':
        '你可以在 Comfy Cloud 上运行，无需本地 GPU；权重开放后也可在本地的 ComfyUI 中运行。MiniMax 合作伙伴节点已在 ComfyUI 中提供。'
    }
  },
  {
    id: 'cost',
    question: {
      en: 'What does it cost?',
      'zh-CN': '费用是多少？'
    },
    answer: {
      en: 'Running the weights locally is free. On Comfy Cloud, H3 is billed per second of generated video like other partner models — see the pricing page for current rates.',
      'zh-CN':
        '在本地运行权重是免费的。在 Comfy Cloud 上，H3 与其他合作伙伴模型一样按生成视频的秒数计费，具体费率请查看定价页面。'
    }
  }
] as const
