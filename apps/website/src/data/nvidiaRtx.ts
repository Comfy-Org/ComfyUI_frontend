import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const nvidiaRtxLinks = {
  download: 'https://comfy.org/download/',
  guide: 'https://docs.comfy.org/installation/desktop/windows',
  cloud: externalLinks.cloudCta('nvidia_rtx')
} as const

// Stand-in media until the NVIDIA RTX hero and gallery renders reach
// media.comfy.org; swap these for the supplied files before this page ships.
const placeholderMediaBase = 'https://media.comfy.org/website/chatgpt-image-2.5'

const media = {
  vaporwave: { kind: 'image', src: `${placeholderMediaBase}/vaporwave.webp` },
  aliens: {
    kind: 'image',
    src: `${placeholderMediaBase}/alien-convenience-store.webp`
  },
  goldfish: { kind: 'image', src: `${placeholderMediaBase}/goldfish.webp` },
  engine: { kind: 'image', src: `${placeholderMediaBase}/flame-engine.webp` },
  canyon: { kind: 'image', src: `${placeholderMediaBase}/canyon-chase.webp` },
  horizon: { kind: 'image', src: `${placeholderMediaBase}/anime-horizon.webp` }
} as const satisfies Record<string, ModelLaunchMedia>

const localNote = { en: 'Runs locally', 'zh-CN': '本地运行' }

export const nvidiaRtxPage: ModelLaunchPage = {
  metaTitleKey: 'nvidiaRtx.meta.title',
  metaDescriptionKey: 'nvidiaRtx.meta.description',
  breadcrumbLabelKey: 'nvidiaRtx.breadcrumb.model',
  breadcrumbUpdatedKey: 'nvidiaRtx.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    placeholderImageSrc: '/images/models/qwen-image-2-1-logo-mask.webp',
    logoSrc: '/icons/ai-models/nvidia.png',
    logoSize: 'large',
    titleKey: 'nvidiaRtx.hero.title',
    descriptionKey: 'nvidiaRtx.hero.description',
    badgeKeys: [
      'nvidiaRtx.hero.tagUpscale',
      'nvidiaRtx.hero.tagFrameRate',
      'nvidiaRtx.hero.tagSdrToHdr'
    ],
    primaryCta: {
      labelKey: 'nvidiaRtx.hero.primaryCta',
      href: nvidiaRtxLinks.download
    },
    secondaryCta: {
      labelKey: 'nvidiaRtx.hero.secondaryCta',
      href: nvidiaRtxLinks.guide,
      target: '_blank'
    }
  },
  gallery: {
    headingKey: 'nvidiaRtx.gallery.heading',
    ctaVariant: 'accent',
    cards: [
      {
        id: 'vaporwave-atmosphere',
        name: {
          en: 'Vaporwave architecture generated locally on NVIDIA RTX',
          'zh-CN': '在 NVIDIA RTX 上本地生成的蒸汽波建筑场景'
        },
        tier: 'free',
        note: localNote,
        description: {
          en: 'Iterate on a look as many times as you like, with every run on your own GPU.',
          'zh-CN': '反复打磨画面风格，每一次运行都在你自己的 GPU 上完成。'
        },
        media: media.vaporwave,
        href: nvidiaRtxLinks.download
      },
      {
        id: 'alien-convenience-store',
        name: {
          en: 'Aliens in a convenience store generated locally on NVIDIA RTX',
          'zh-CN': '在 NVIDIA RTX 上本地生成的便利店外星人场景'
        },
        tier: 'free',
        note: localNote,
        description: {
          en: 'Batch dozens of variations overnight without watching a meter.',
          'zh-CN': '通宵批量生成数十个变体，无需担心用量计费。'
        },
        media: media.aliens,
        href: nvidiaRtxLinks.download
      },
      {
        id: 'goldfish-fisheye',
        name: {
          en: 'Goldfish in a glass bowl generated locally on NVIDIA RTX',
          'zh-CN': '在 NVIDIA RTX 上本地生成的玻璃鱼缸金鱼场景'
        },
        tier: 'free',
        note: localNote,
        description: {
          en: 'Stack LoRAs, ControlNets, and upscalers in one graph on your desktop.',
          'zh-CN': '在桌面上的同一图形中叠加 LoRA、ControlNet 与放大模型。'
        },
        media: media.goldfish,
        href: nvidiaRtxLinks.download
      },
      {
        id: 'flame-engine',
        name: {
          en: 'Flaming engine watercolor generated locally on NVIDIA RTX',
          'zh-CN': '在 NVIDIA RTX 上本地生成的火焰引擎水彩画'
        },
        tier: 'free',
        note: localNote,
        description: {
          en: 'Keep client assets and unreleased work on your own machine.',
          'zh-CN': '客户素材与未发布作品始终留在你自己的电脑上。'
        },
        media: media.engine,
        href: nvidiaRtxLinks.download
      },
      {
        id: 'canyon-chase',
        name: {
          en: 'Canyon car chase generated locally on NVIDIA RTX',
          'zh-CN': '在 NVIDIA RTX 上本地生成的峡谷飞车追逐场景'
        },
        tier: 'free',
        note: localNote,
        description: {
          en: 'Turn a still into motion with open video models running on RTX.',
          'zh-CN': '借助在 RTX 上运行的开源视频模型，让静帧动起来。'
        },
        media: media.canyon,
        href: nvidiaRtxLinks.download
      },
      {
        id: 'anime-horizon',
        name: {
          en: 'Anime hero at a red horizon generated locally on NVIDIA RTX',
          'zh-CN': '在 NVIDIA RTX 上本地生成的红日地平线动画场景'
        },
        tier: 'free',
        note: localNote,
        description: {
          en: 'Fine-tune a style and reuse it across every shot in a project.',
          'zh-CN': '微调一种风格，并在项目的每个镜头中复用。'
        },
        media: media.horizon,
        href: nvidiaRtxLinks.download
      }
    ]
  },
  steps: {
    headingKey: 'nvidiaRtx.steps.heading',
    stepLabelKey: 'nvidiaRtx.steps.step',
    items: [
      {
        id: 'download',
        title: { en: 'Download Comfy Desktop', 'zh-CN': '下载 Comfy Desktop' },
        description: {
          en: 'The Windows app sets up ComfyUI for your RTX GPU.',
          'zh-CN': 'Windows 应用会为你的 RTX GPU 配置好 ComfyUI。'
        }
      },
      {
        id: 'open-template',
        title: {
          en: 'Open the RTX Video template',
          'zh-CN': '打开 RTX Video 模板'
        },
        description: {
          en: 'Super Resolution, Frame Generation, and TrueHDR, already wired together.',
          'zh-CN': '超分辨率、帧生成与 TrueHDR，已经串联就绪。'
        }
      },
      {
        id: 'run-locally',
        title: { en: 'Run it on your GPU', 'zh-CN': '在你的 GPU 上运行' },
        description: {
          en: 'No cloud, no credits, no uploads.',
          'zh-CN': '无需云端、无需积分、无需上传。'
        }
      }
    ],
    primaryCta: {
      labelKey: 'nvidiaRtx.steps.primaryCta',
      href: nvidiaRtxLinks.download
    }
  },
  faq: {
    headingKey: 'nvidiaRtx.faq.heading',
    items: [
      {
        id: 'which-gpus',
        question: {
          en: 'Which NVIDIA GPUs can run ComfyUI?',
          'zh-CN': '哪些 NVIDIA GPU 可以运行 ComfyUI？'
        },
        answer: {
          en: 'ComfyUI runs on NVIDIA GeForce RTX and NVIDIA RTX professional GPUs. More VRAM lets you run larger models and higher resolutions; lighter quantized models are available for cards with less memory.',
          'zh-CN':
            'ComfyUI 可在 NVIDIA GeForce RTX 与 NVIDIA RTX 专业级 GPU 上运行。显存越大，可运行的模型与分辨率越高；显存较小的显卡也可使用更轻量的量化模型。'
        }
      },
      {
        id: 'is-it-free',
        question: {
          en: 'Is running ComfyUI locally free?',
          'zh-CN': '在本地运行 ComfyUI 免费吗？'
        },
        answer: {
          en: 'Yes. ComfyUI is open source, and open models run on your own hardware at no cost. Partner Nodes for hosted models such as Veo or Kling use credits.',
          'zh-CN':
            '是的。ComfyUI 是开源软件，开源模型在你自己的硬件上免费运行。调用 Veo、Kling 等托管模型的合作伙伴节点需要消耗积分。'
        }
      },
      {
        id: 'how-to-start',
        question: {
          en: 'How do I get started on an RTX PC?',
          'zh-CN': '如何在 RTX 电脑上开始使用？'
        },
        answer: {
          en: `[Download ComfyUI](${nvidiaRtxLinks.download}), open the template browser, and pick a workflow. ComfyUI downloads the models it needs and runs them on your GPU.`,
          'zh-CN': `[下载 ComfyUI](${nvidiaRtxLinks.download})，打开模板浏览器并选择一个工作流。ComfyUI 会下载所需模型，并在你的 GPU 上运行。`
        }
      },
      {
        id: 'privacy',
        question: {
          en: 'Do my files leave my computer?',
          'zh-CN': '我的文件会离开我的电脑吗？'
        },
        answer: {
          en: 'Not when you run open models locally. Prompts, inputs, and outputs stay on your machine unless you choose to use a Partner Node or Comfy Cloud.',
          'zh-CN':
            '在本地运行开源模型时不会。除非你选择使用合作伙伴节点或 Comfy Cloud，否则提示词、输入与输出都保留在你的电脑上。'
        }
      },
      {
        id: 'local-or-cloud',
        question: {
          en: 'Should I run locally or on Comfy Cloud?',
          'zh-CN': '我应该在本地运行还是使用 Comfy Cloud？'
        },
        answer: {
          en: `Both run the same workflows. Run locally on RTX when you want full control and unlimited iterations; use [Comfy Cloud](${nvidiaRtxLinks.cloud}) when a job needs more VRAM than your card has.`,
          'zh-CN': `两者运行的是相同的工作流。想要完全掌控并无限次迭代时，在 RTX 上本地运行；当任务所需显存超出显卡容量时，使用 [Comfy Cloud](${nvidiaRtxLinks.cloud})。`
        }
      }
    ]
  },
  sectionOrder: ['gallery', 'steps', 'faq'],
  runOptions: {
    headingKey: 'nvidiaRtx.runOptions.heading',
    subtitleKey: 'nvidiaRtx.runOptions.subtitle',
    ctaKey: 'nvidiaRtx.runOptions.cta'
  },
  reviews: {
    headingKey: 'nvidiaRtx.reviews.heading',
    autoplayMs: 4000,
    highlight: {
      titleKey: 'nvidiaRtx.reviews.highlightTitle',
      descriptionKey: 'nvidiaRtx.reviews.highlightDescription',
      ctaKey: 'nvidiaRtx.reviews.highlightCta',
      route: 'agent'
    }
  }
}
