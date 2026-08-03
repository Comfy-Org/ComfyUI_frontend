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
export const minimaxH3NoindexUntilLaunch: boolean = true

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

// Each highlight restates a claim already made in the hero description, so
// nothing here is a new marketing claim.
export const minimaxH3Highlights: readonly MinimaxH3Highlight[] = [
  {
    id: 'open-weights',
    label: { en: 'Open weights', 'zh-CN': '开放权重' },
    detail: {
      en: 'The open release of Hailuo 3.0, runnable locally.',
      'zh-CN': 'Hailuo 3.0 的开放权重版本，可在本地运行。'
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
    id: 'local-hardware',
    label: { en: 'Runs on your hardware', 'zh-CN': '在你的硬件上运行' },
    detail: {
      en: 'A big model made small enough to run comfortably on a regular RTX 3060.',
      'zh-CN': '大模型经过压缩，一张普通的 RTX 3060 即可流畅运行。'
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
      en: 'Write the shot and H3 renders it, audio included.',
      'zh-CN': '写下镜头描述，H3 渲染成片，并同步生成音频。'
    },
    videoSrc: media.textToVideo,
    href: externalLinks.workflows
  },
  {
    id: 'image-to-video',
    title: { en: 'Image to video', 'zh-CN': '图像生成视频' },
    description: {
      en: 'Bring a still into motion, or pin the first and last frame and H3 fills the shot.',
      'zh-CN': '让静态画面动起来，或固定首末帧，由 H3 补全整个镜头。'
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

// Answers are deliberately limited to facts in the final launch email copy
// approved in #gtm-mini-max and the open-weights release itself. Each answer
// opens with a self-contained direct statement so it can be lifted verbatim
// into search AI overviews and the FAQPage structured data.
export const minimaxH3Faqs: readonly MinimaxH3Faq[] = [
  {
    id: 'what-is-minimax-h3',
    question: {
      en: 'What is MiniMax H3?',
      'zh-CN': 'MiniMax H3 是什么？'
    },
    answer: {
      en: 'MiniMax H3 is the open-weight release of Hailuo 3.0, a video generation model from MiniMax. It turns text, images, or reference inputs into video with stereo sound, at up to 2K resolution and 5 to 15 seconds per generation.',
      'zh-CN':
        'MiniMax H3 是 Hailuo 3.0 的开放权重版本，是 MiniMax 推出的视频生成模型。它可将文本、图像或参考输入生成带立体声的视频，最高 2K 分辨率，每次生成 5 至 15 秒。'
    }
  },
  {
    id: 'open-source-free',
    question: {
      en: 'Is MiniMax H3 free and open source?',
      'zh-CN': 'MiniMax H3 是免费开源的吗？'
    },
    answer: {
      en: 'The MiniMax H3 weights are openly released. Download them and run H3 locally in ComfyUI at no cost beyond your own hardware. On Comfy Cloud, H3 runs on hosted GPUs and generations are billed in credits; current rates are on the pricing page.',
      'zh-CN':
        'MiniMax H3 的权重已开放发布。下载权重后即可在本地 ComfyUI 中免费运行，只需自备硬件。在 Comfy Cloud 上，H3 在托管 GPU 上运行，按积分计费，最新费率见定价页面。'
    }
  },
  {
    id: 'gpu-requirements',
    question: {
      en: 'What GPU do I need to run MiniMax H3 locally?',
      'zh-CN': '本地运行 MiniMax H3 需要什么 GPU？'
    },
    answer: {
      en: 'MiniMax H3 runs comfortably on a regular RTX 3060 in ComfyUI. It is a big model made small enough for consumer hardware, so no datacenter GPU is required.',
      'zh-CN':
        '在 ComfyUI 中，一张普通的 RTX 3060 就能流畅运行 MiniMax H3。这个大模型经过压缩，适配消费级硬件，无需数据中心级 GPU。'
    }
  },
  {
    id: 'generation-modes',
    question: {
      en: 'What can MiniMax H3 generate?',
      'zh-CN': 'MiniMax H3 能生成什么？'
    },
    answer: {
      en: 'MiniMax H3 supports text to video, image to video with first and last frame control, and reference to video. Every clip includes stereo sound, generated in the same pass as the frames.',
      'zh-CN':
        'MiniMax H3 支持文本生成视频、带首末帧控制的图像生成视频，以及参考生成视频。每段片段都带立体声，与画面在同一次生成中输出。'
    }
  },
  {
    id: 'hailuo-relationship',
    question: {
      en: 'How is MiniMax H3 related to Hailuo 3.0?',
      'zh-CN': 'MiniMax H3 与 Hailuo 3.0 是什么关系？'
    },
    answer: {
      en: 'MiniMax H3 is the open release of Hailuo 3.0. The generations come from the same model family; the difference is that H3 ships weights you can download, inspect, and run yourself.',
      'zh-CN':
        'MiniMax H3 就是 Hailuo 3.0 的开放权重版本。生成能力来自同一模型家族，区别在于 H3 提供可下载、可检查、可自行运行的权重。'
    }
  },
  {
    id: 'how-to-run',
    question: {
      en: 'How do I run MiniMax H3 in ComfyUI?',
      'zh-CN': '如何在 ComfyUI 中运行 MiniMax H3？'
    },
    answer: {
      en: 'Update ComfyUI to the latest version, load a MiniMax H3 workflow, and press Run. The same workflow runs locally on your GPU or on Comfy Cloud with no local install.',
      'zh-CN':
        '将 ComfyUI 更新到最新版本，载入 MiniMax H3 工作流，点击运行即可。同一个工作流既可在本地 GPU 上运行，也可在无需本地安装的 Comfy Cloud 上运行。'
    }
  }
] as const
