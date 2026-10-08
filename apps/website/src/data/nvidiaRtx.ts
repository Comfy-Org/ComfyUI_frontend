import type {
  ModelLaunchBeforeAfter,
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const nvidiaRtxLinks = {
  download: 'https://comfy.org/download/',
  github: 'https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI',
  // Swap for the Comfy Cloud workflow that chains all three nodes once it
  // exists; until then the CTA lands on the generic cloud entry point.
  cloud: externalLinks.cloudCta('nvidia_rtx')
} as const

// Stand-in media until the NVIDIA RTX hero, gallery, and before/after clips
// reach media.comfy.org; swap these for the supplied files before this page
// ships.
const placeholderMediaBase = 'https://media.comfy.org/website/chatgpt-image-2.5'
const placeholderClipBase = 'https://media.comfy.org/website'

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

const beforeAfter: ModelLaunchBeforeAfter = {
  headingKey: 'nvidiaRtx.beforeAfter.heading',
  bodyKey: 'nvidiaRtx.beforeAfter.body',
  tabs: [
    {
      id: 'super-resolution',
      label: { en: 'Super Resolution', 'zh-CN': '超分辨率' },
      caption: {
        en: 'Same clip, more resolution.',
        'zh-CN': '同一段视频，更高的分辨率。'
      },
      beforeSrc: `${placeholderClipBase}/flux-3/card-1.webm`,
      afterSrc: `${placeholderClipBase}/flux-3/card-2.webm`
    },
    {
      id: 'frame-generation',
      label: { en: 'Frame Generation', 'zh-CN': '帧生成' },
      caption: {
        en: '15 fps in, 60 fps out.',
        'zh-CN': '输入 15 fps，输出 60 fps。'
      },
      beforeSrc: `${placeholderClipBase}/cloud/ai-models/wan-22.webm`,
      afterSrc: `${placeholderClipBase}/cloud/ai-models/gpt-image-2.webm`
    },
    {
      id: 'true-hdr',
      label: { en: 'True HDR', 'zh-CN': 'True HDR' },
      caption: {
        en: 'SDR in, HDR out. Best viewed on an HDR display.',
        'zh-CN': '输入 SDR，输出 HDR。建议在 HDR 显示器上观看。'
      },
      beforeSrc: `${placeholderClipBase}/local/racer.webm`,
      afterSrc: `${placeholderClipBase}/gemini-omni/card-1.webm`
    }
  ]
}

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
  beforeAfter,
  gallery: {
    headingKey: 'nvidiaRtx.gallery.heading',
    ctaVariant: 'none',
    cardMeta: 'none',
    mobileVisibleCards: 3,
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
          en: 'Convert SDR footage to HDR in a single node with True HDR.',
          'zh-CN': '使用 True HDR，一个节点即可将 SDR 素材转换为 HDR。'
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
          en: 'Drop the nodes into any existing ComfyUI video workflow.',
          'zh-CN': '将这些节点加入任何现有的 ComfyUI 视频工作流。'
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
          en: 'Open source, so you can inspect, fork, and extend every node.',
          'zh-CN': '完全开源，每个节点都可以查看、复刻与扩展。'
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
        id: 'any-gpu',
        question: {
          en: 'Can the Nvidia VFX nodes run on any GPU?',
          'zh-CN': 'Nvidia VFX 节点可以在任何 GPU 上运行吗？'
        },
        answer: {
          en: "No. The nvidia-vfx library requires an Nvidia GPU powered by Nvidia's proprietary technology.",
          'zh-CN':
            '不可以。nvidia-vfx 库需要由 Nvidia 专有技术驱动的 Nvidia GPU。'
        }
      },
      {
        id: 'open-source',
        question: {
          en: 'Are the nodes open source?',
          'zh-CN': '这些节点是开源的吗？'
        },
        answer: {
          en: `Yes. All three nodes are published on [GitHub](${nvidiaRtxLinks.github}) and install as a ComfyUI custom node.`,
          'zh-CN': `是的。三个节点均已发布在 [GitHub](${nvidiaRtxLinks.github}) 上，可作为 ComfyUI 自定义节点安装。`
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
  sectionOrder: ['beforeAfter', 'gallery', 'steps', 'faq'],
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
