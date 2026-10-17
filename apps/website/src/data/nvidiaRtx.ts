import type {
  ModelLaunchBeforeAfter,
  ModelLaunchMedia,
  ModelLaunchPage
} from '@/templates/model-launch/types'

const nvidiaRtxLinks = {
  download: 'https://comfy.org/download/',
  github: 'https://github.com/Comfy-Org/ComfyUI_Nvidia_VFX_Nodes',
  cloud:
    'https://cloud.comfy.org/?template=utility_nvidia_rtx_video_enhance&utm_source=comfy.org&utm_medium=referral&utm_campaign=nvidia-vfx'
} as const

const media = {
  pipeline: { kind: 'image', src: '/images/models/nvidia-vfx-pipeline.jpg' }
} as const satisfies Record<string, ModelLaunchMedia>

const localNote = { en: 'Runs locally', 'zh-CN': '本地运行' }

const clipBase = 'https://media.comfy.org/website/nvidia-rtx'
const heroClip = `${clipBase}/nvidia-vfx-nodes-ab-720p.mp4`

const beforeAfter: ModelLaunchBeforeAfter = {
  headingKey: 'nvidiaRtx.beforeAfter.heading',
  bodyKey: 'nvidiaRtx.beforeAfter.body',
  tabs: [
    {
      id: 'super-resolution',
      label: { en: 'Super Resolution', 'zh-CN': '超分辨率' },
      caption: {
        en: 'Upscale low-resolution footage up to 4× with Super Resolution.',
        'zh-CN': '使用超分辨率将低分辨率素材放大最高 4 倍。'
      },
      beforeSrc: `${clipBase}/super-resolution-before.mp4`,
      afterSrc: `${clipBase}/super-resolution-after.mp4`,
      beforePosterSrc: `${clipBase}/nvidia-vfx-super-resolution-before.jpg`,
      afterPosterSrc: `${clipBase}/nvidia-vfx-super-resolution-after.jpg`
    },
    {
      id: 'frame-generation',
      label: { en: 'Frame Generation', 'zh-CN': '帧生成' },
      caption: {
        en: 'Multiply frame rate up to 16× with Frame Generation for smooth slow motion.',
        'zh-CN': '使用帧生成将帧率提升最高 16 倍，获得流畅的慢动作。'
      },
      beforeSrc: `${clipBase}/frame-generation-before.mp4`,
      afterSrc: `${clipBase}/frame-generation-after.mp4`,
      beforePosterSrc: `${clipBase}/nvidia-vfx-frame-generation-before.jpg`,
      afterPosterSrc: `${clipBase}/nvidia-vfx-frame-generation-after.jpg`
    },
    {
      id: 'sdr-to-hdr',
      label: { en: 'SDR-to-HDR', 'zh-CN': 'SDR 转 HDR' },
      caption: {
        en: 'SDR in, HDR out. Best viewed on an HDR display.',
        'zh-CN': '输入 SDR，输出 HDR。建议在 HDR 显示器上观看。'
      },
      beforeSrc: `${clipBase}/sdr-to-hdr-before.mp4`,
      afterSrc: `${clipBase}/sdr-to-hdr-after.mp4`,
      beforePosterSrc: `${clipBase}/nvidia-vfx-sdr-to-hdr-before.jpg`,
      afterPosterSrc: `${clipBase}/nvidia-vfx-sdr-to-hdr-after.jpg`
    }
  ]
}

export const nvidiaRtxPage: ModelLaunchPage = {
  metaTitleKey: 'nvidiaRtx.meta.title',
  metaDescriptionKey: 'nvidiaRtx.meta.description',
  breadcrumbLabelKey: 'nvidiaRtx.breadcrumb.model',
  breadcrumbUpdatedKey: 'nvidiaRtx.breadcrumb.updated',
  stackBreadcrumbOnMobile: true,
  hero: {
    layout: 'media-first',
    mediaOutline: 'gray',
    videoSrc: heroClip,
    posterSrc: '/images/models/nvidia-vfx-hero-poster.jpg',
    mobileFallbackImageSrc: '/images/models/nvidia-vfx-hero-poster.jpg',
    // The 720p clip is already light enough for phones, so they play it too.
    mobileVideoSrc: heroClip,
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
      href: nvidiaRtxLinks.cloud,
      target: '_blank'
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
    captionPlacement: 'overlay',
    cards: [
      {
        id: 'full-pipeline',
        span: 'full',
        expandable: true,
        name: {
          en: 'Super Resolution, Frame Generation and Video HDR nodes chained in one ComfyUI workflow',
          'zh-CN':
            '在同一 ComfyUI 工作流中串联超分辨率、帧生成与 Video HDR 节点'
        },
        tier: 'free',
        note: localNote,
        description: {
          en: 'Chain all three nodes in one workflow and run it on your RTX GPU.',
          'zh-CN': '在同一工作流中串联三个节点，并在你的 RTX GPU 上运行。'
        },
        media: media.pipeline,
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
          en: "No. The nvidia-vfx library requires an Nvidia RTX GPU powered by Nvidia's proprietary technology. The RTX Video Frame Generation is supported on Nvidia 40 series and later only.",
          'zh-CN':
            '不可以。nvidia-vfx 库需要由 Nvidia 专有技术驱动的 Nvidia RTX GPU。RTX 视频帧生成仅支持 Nvidia 40 系列及更新的显卡。'
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
  sectionOrder: ['beforeAfter', 'gallery', 'steps', 'faq'],
  runOptions: {
    headingKey: 'nvidiaRtx.runOptions.heading',
    subtitleKey: 'nvidiaRtx.runOptions.subtitle',
    ctaKey: 'nvidiaRtx.runOptions.cta'
  },
  reviews: {
    headingKey: 'nvidiaRtx.reviews.heading',
    autoplayMs: 4000,
    quoteSize: 'compact',
    highlight: {
      titleKey: 'nvidiaRtx.reviews.highlightTitle',
      descriptionKey: 'nvidiaRtx.reviews.highlightDescription',
      ctaKey: 'nvidiaRtx.reviews.highlightCta',
      route: 'agent'
    }
  }
}
