import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const nvidiaRtxLinks = {
  download: 'https://comfy.org/download/',
  github: 'https://github.com/Comfy-Org/ComfyUI_Nvidia_VFX_Nodes',
  // Swap for the Comfy Cloud workflow that chains all three nodes once it
  // exists; until then the CTA lands on the generic cloud entry point.
  cloud: externalLinks.cloudCta('nvidia_rtx')
} as const

// Stand-in gallery images until the supplied files reach media.comfy.org;
// swap these before this page ships.
const placeholderMediaBase = 'https://media.comfy.org/website/chatgpt-image-2.5'

const media = {
  vaporwave: { kind: 'image', src: `${placeholderMediaBase}/vaporwave.webp` },
  aliens: {
    kind: 'image',
    src: `${placeholderMediaBase}/alien-convenience-store.webp`
  },
  goldfish: { kind: 'image', src: `${placeholderMediaBase}/goldfish.webp` },
  engine: { kind: 'image', src: `${placeholderMediaBase}/flame-engine.webp` }
} as const satisfies Record<string, ModelLaunchMedia>

const localNote = { en: 'Runs locally', 'zh-CN': '本地运行' }

export const nvidiaRtxPage: ModelLaunchPage = {
  metaTitleKey: 'nvidiaRtx.meta.title',
  metaDescriptionKey: 'nvidiaRtx.meta.description',
  breadcrumbLabelKey: 'nvidiaRtx.breadcrumb.model',
  breadcrumbUpdatedKey: 'nvidiaRtx.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    videoSrc:
      'https://media.comfy.org/website/nvidia-rtx/nvidia-vfx-nodes-ab-720p.mp4',
    mobileVideoSrc:
      'https://media.comfy.org/website/nvidia-rtx/nvidia-vfx-nodes-ab-mobile.mp4',
    posterSrc: '/images/models/nvidia-vfx-hero-poster.jpg',
    mobileFallbackImageSrc: '/images/models/nvidia-vfx-hero-poster.jpg',
    titleKey: 'nvidiaRtx.hero.title',
    titleSize: 'compact',
    descriptionKey: 'nvidiaRtx.hero.description',
    badgeKeys: [
      'nvidiaRtx.hero.tagUpscale',
      'nvidiaRtx.hero.tagFrameRate',
      'nvidiaRtx.hero.tagSdrToHdr'
    ],
    primaryCta: {
      labelKey: 'nvidiaRtx.hero.primaryCta',
      href: nvidiaRtxLinks.cloud
    },
    secondaryCta: {
      labelKey: 'nvidiaRtx.hero.secondaryCta',
      href: nvidiaRtxLinks.github,
      target: '_blank'
    }
  },
  gallery: {
    headingKey: 'nvidiaRtx.gallery.heading',
    ctaVariant: 'none',
    cardMeta: 'none',
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
          en: 'Upscale low-resolution footage up to 4× with Super Resolution.',
          'zh-CN': '使用超分辨率将低分辨率素材放大最高 4 倍。'
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
          en: 'Multiply frame rate up to 16× with Frame Generation for smooth slow motion.',
          'zh-CN': '使用帧生成将帧率提升最高 16 倍，获得流畅的慢动作。'
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
          en: 'Convert SDR footage to HDR.',
          'zh-CN': '将 SDR 素材转换为 HDR。'
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
          en: 'Chain all three nodes in one workflow and run it on your RTX GPU.',
          'zh-CN': '在同一工作流中串联三个节点，并在你的 RTX GPU 上运行。'
        },
        media: media.engine,
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
          en: 'The desktop app sets up ComfyUI for you on your computer.',
          'zh-CN': '桌面应用会在你的电脑上为你配置好 ComfyUI。'
        }
      },
      {
        id: 'install-nodes',
        title: {
          en: 'Install the ComfyUI Nvidia VFX Nodes',
          'zh-CN': '安装 ComfyUI Nvidia VFX 节点'
        },
        description: {
          en: 'Open the example workflows from the custom node.',
          'zh-CN': '打开自定义节点附带的示例工作流。'
        }
      },
      {
        id: 'run-locally',
        title: {
          en: 'Run it on your Nvidia RTX GPU',
          'zh-CN': '在你的 Nvidia RTX GPU 上运行'
        },
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
        id: 'any-gpu',
        question: {
          en: 'Can the Nvidia VFX nodes run on any GPU?',
          'zh-CN': 'Nvidia VFX 节点可以在任何 GPU 上运行吗？'
        },
        answer: {
          en: "No. The nvidia-vfx library requires an Nvidia GPU powered by Nvidia's proprietary technology. The RTX Video Frame Generation is supported on Nvidia 40 series and later only.",
          'zh-CN':
            '不可以。nvidia-vfx 库需要由 Nvidia 专有技术驱动的 Nvidia GPU。RTX 视频帧生成仅支持 Nvidia 40 系列及更新的显卡。'
        }
      },
      {
        id: 'open-source',
        question: {
          en: 'Are the nodes open source?',
          'zh-CN': '这些节点是开源的吗？'
        },
        answer: {
          en: `Yes. All three nodes are published on [GitHub](${nvidiaRtxLinks.github}) and install as a ComfyUI custom node. The nodes are licensed Apache-2.0, so they are free for commercial use. The nvidia-vfx library they depend on is distributed by Nvidia under its own proprietary license.`,
          'zh-CN': `是的。三个节点均已发布在 [GitHub](${nvidiaRtxLinks.github}) 上，可作为 ComfyUI 自定义节点安装。节点采用 Apache-2.0 许可，可免费用于商业用途。它们依赖的 nvidia-vfx 库由 Nvidia 以其专有许可分发。`
        }
      },
      {
        id: 'example-workflows',
        question: {
          en: 'Where do I find example workflows?',
          'zh-CN': '哪里可以找到示例工作流？'
        },
        answer: {
          en: 'The custom node ships with example workflows for each node. Open them from ComfyUI after installing.',
          'zh-CN':
            '自定义节点附带每个节点的示例工作流。安装后即可在 ComfyUI 中打开。'
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
