import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// MiniMax H3 renders, encoded to the site's web video profile and served from
// media.comfy.org. Each poster is the clip's own first frame, so it registers
// exactly with the video that replaces it.
const media = {
  hero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/minimax/hero-sizzle.mp4',
    posterSrc: 'https://media.comfy.org/website/minimax/hero-poster.webp'
  },
  iceRider: {
    kind: 'video',
    src: 'https://media.comfy.org/website/minimax/ice-rider.webm',
    posterSrc: 'https://media.comfy.org/website/minimax/ice-rider-poster.webp'
  },
  sunkenTemple: {
    kind: 'video',
    src: 'https://media.comfy.org/website/minimax/sunken-temple.webm',
    posterSrc:
      'https://media.comfy.org/website/minimax/sunken-temple-poster.webp'
  },
  nightAscent: {
    kind: 'video',
    src: 'https://media.comfy.org/website/minimax/night-ascent.webm',
    posterSrc:
      'https://media.comfy.org/website/minimax/night-ascent-poster.webp'
  },
  fluid: {
    kind: 'video',
    src: 'https://media.comfy.org/website/minimax/fluid.webm',
    posterSrc: 'https://media.comfy.org/website/minimax/fluid-poster.webp'
  },
  superhero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/minimax/superhero.webm',
    posterSrc: 'https://media.comfy.org/website/minimax/superhero-poster.webp'
  },
  comfyCan: {
    kind: 'video',
    src: 'https://media.comfy.org/website/minimax/comfy-can.webm',
    posterSrc: 'https://media.comfy.org/website/minimax/comfy-can-poster.webp'
  }
} as const satisfies Record<string, ModelLaunchMedia>

// Not part of `media` above: it is a plain still, not a `ModelLaunchMedia`
// video/image the gallery renders, so keeping it out of that record avoids
// widening the `satisfies` shape for a value only the hero's mobile branch
// consumes.
const heroFallbackSrc =
  'https://media.comfy.org/website/minimax/hero-fallback.jpg'

export const minimaxLinks = {
  cloudRun: 'https://cloud.comfy.org/?share=a781503cf508',
  textToVideo: 'https://comfy.org/workflows/e8099b642c9f-e8099b642c9f/',
  referenceToVideo: 'https://comfy.org/workflows/46a303cbccf9-46a303cbccf9/',
  imageToVideo: 'https://comfy.org/workflows/a781503cf508-a781503cf508/',
  iceRider: 'https://comfy.org/workflows/b34841f6789c-b34841f6789c/',
  docs: 'https://docs.comfy.org/tutorials/video/minimax/minimax-h3',
  blog: 'https://blog.comfy.org/p/minimax-h3-day-0-support-in-comfyui'
} as const

export const minimaxPage = {
  metaTitleKey: 'minimax.meta.title',
  metaDescriptionKey: 'minimax.meta.description',
  breadcrumbLabelKey: 'minimax.breadcrumb.model',
  breadcrumbUpdatedKey: 'minimax.breadcrumb.updated',
  hero: {
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    mobileFallbackImageSrc: heroFallbackSrc,
    logoSrc: '/icons/ai-models/minimax.svg',
    titleKey: 'minimax.hero.titleModel',
    titleRestKey: 'minimax.hero.titleRest',
    descriptionKey: 'minimax.hero.description',
    primaryCta: {
      labelKey: 'minimax.hero.primaryCta',
      href: minimaxLinks.cloudRun,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'minimax.hero.secondaryCta',
      href: minimaxLinks.imageToVideo,
      target: '_blank'
    },
    badgeKeys: ['minimax.hero.tagOpenWeights', 'minimax.hero.tagPartnerNodes']
  },
  gallery: {
    headingKey: 'minimax.models.heading',
    cards: [
      {
        id: 'liquid-chrome',
        name: { en: 'Liquid chrome', 'zh-CN': '液态铬' },
        tier: 'premium',
        note: { en: 'Text to video', 'zh-CN': '文本生成视频' },
        description: {
          en: 'A chrome fluid ripples under teal and amber light, a stress test for reflection and micro-detail.',
          'zh-CN':
            '青与琥珀光下的液态铬面泛起涟漪，是对反射与微观细节的一次压力测试。'
        },
        media: media.fluid,
        href: minimaxLinks.textToVideo
      },
      {
        id: 'sunken-temple',
        name: { en: 'Sunken temple', 'zh-CN': '沉没神殿' },
        tier: 'premium',
        note: { en: 'Text to video', 'zh-CN': '文本生成视频' },
        description: {
          en: 'God-rays drift through a flooded temple of carved gold, holding light and depth steady across the whole shot.',
          'zh-CN': '光束穿过被水淹没的黄金浮雕神殿，全程保持光影与景深的稳定。'
        },
        media: media.sunkenTemple,
        href: minimaxLinks.textToVideo
      },
      {
        id: 'night-ascent',
        name: { en: 'Night ascent', 'zh-CN': '夜间攀登' },
        tier: 'premium',
        note: { en: 'Text to video', 'zh-CN': '文本生成视频' },
        description: {
          en: 'A headlamped climber pushes up a moonlit dune, fine grain and motion kept clean in near-dark.',
          'zh-CN':
            '头灯登山者攀上月光沙丘，近乎全黑的画面中颗粒与运动依旧干净。'
        },
        media: media.nightAscent,
        href: minimaxLinks.textToVideo
      },
      {
        id: 'ice-rider',
        name: { en: 'Ice canyon rider', 'zh-CN': '冰川峡谷骑手' },
        tier: 'premium',
        note: { en: 'Text to video', 'zh-CN': '文本生成视频' },
        description: {
          en: 'A lone rider crosses a glacial canyon in one continuous move, camera and native audio straight out of H3.',
          'zh-CN': '骑手一镜到底穿越冰川峡谷，运镜与原生音频均由 H3 直接生成。'
        },
        media: media.iceRider,
        href: minimaxLinks.iceRider
      },
      {
        id: 'backyard-hero',
        name: { en: 'Backyard hero', 'zh-CN': '后院小英雄' },
        tier: 'premium',
        note: { en: 'Reference to video', 'zh-CN': '参考生成视频' },
        description: {
          en: 'A pint-size superhero calls out a towering city monster, character held consistent from a single reference image.',
          'zh-CN':
            '小小超级英雄向巨型城市怪兽宣战，仅凭一张参考图便保持角色始终如一。'
        },
        media: media.superhero,
        href: minimaxLinks.referenceToVideo
      },
      {
        id: 'stay-comfy-can',
        name: { en: 'Stay Comfy can', 'zh-CN': 'Stay Comfy 罐' },
        tier: 'premium',
        note: { en: 'Reference to video', 'zh-CN': '参考生成视频' },
        description: {
          en: 'One product shot becomes a full scene — the label stays crisp as the can pours out beside a waterfall.',
          'zh-CN':
            '一张产品图生成完整场景 — 瀑布旁倾倒的罐身上，标签始终清晰锐利。'
        },
        media: media.comfyCan,
        href: minimaxLinks.referenceToVideo
      }
    ]
  },
  pricing: {
    // The Figma opens this page on monthly, unlike the /pricing page.
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'minimax.pricing.banner.title',
      subtitleKey: 'minimax.pricing.banner.subtitle',
      cta: {
        labelKey: 'minimax.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'minimax.faq.heading',
    items: [
      {
        id: 'what-is-minimax',
        question: {
          en: 'What is MiniMax H3?',
          'zh-CN': 'MiniMax H3 是什么？'
        },
        answer: {
          en: `MiniMax's video model, available as Open Weights and through Partner Nodes. It takes text, image, or audio in and renders a clip with native stereo audio. On Comfy you direct it on the canvas alongside every other model. Read [the day-0 launch post](${minimaxLinks.blog}) for the technical details.`,
          'zh-CN': `MiniMax 的视频模型，以开源权重形式提供，也可通过合作伙伴节点使用。它支持文本、图像或音频输入，并渲染出带原生立体声音频的片段。在 Comfy 上，你可以在画布上与其他模型一起执导它。技术细节请见[首日支持发布文章](${minimaxLinks.blog})。`
        }
      },
      {
        id: 'cost-per-generation',
        question: {
          en: 'How much does MiniMax H3 cost per generation?',
          'zh-CN': 'MiniMax H3 每次生成需要多少费用？'
        },
        answer: {
          en: 'It runs on pay-as-you-go or subscription credits. You can draft the same shot free on Wan 2.2 first, and spend credits only on the final render.',
          'zh-CN':
            '它采用按量付费或订阅积分。你可以先在 Wan 2.2 上免费打样同一个镜头，只在最终渲染时消耗积分。'
        }
      },
      {
        id: 'resolution-length',
        question: {
          en: 'What resolution and clip length does MiniMax H3 support?',
          'zh-CN': 'MiniMax H3 支持哪些分辨率和片段时长？'
        },
        answer: {
          en: 'Up to 2K, and 5 to 15 seconds per generation.',
          'zh-CN': '最高 2K，每次生成 5 到 15 秒。'
        }
      },
      {
        id: 'native-audio',
        question: {
          en: 'Does MiniMax H3 generate audio?',
          'zh-CN': 'MiniMax H3 会生成音频吗？'
        },
        answer: {
          en: 'Yes. Every clip carries native stereo audio. When you feed it input audio, H3 conditions on that track instead of overwriting or dropping it.',
          'zh-CN':
            '会。每个片段都带有原生立体声音频。当你输入音频时，H3 会以该音轨为条件进行生成，而不是覆盖或丢弃它。'
        }
      },
      {
        id: 'open-weights',
        question: {
          en: 'Is MiniMax H3 available as Open Weights?',
          'zh-CN': 'MiniMax H3 提供开源权重吗？'
        },
        answer: {
          en: 'Yes. H3 is available as Open Weights, so you can run it yourself, and through Partner Nodes on Comfy Cloud. To use what you make locally for commercial work, [get an H3 commercial license through Comfy](https://comfy.org/minimax/license).',
          'zh-CN':
            '是的。H3 以开源权重形式提供，你可以自行运行；也可以通过 Comfy Cloud 上的合作伙伴节点使用。如需将本地产出用于商业创作，请[通过 Comfy 获取 H3 商业许可](https://comfy.org/zh-CN/minimax/license)。'
        }
      },
      {
        id: 'run-in-comfyui',
        question: {
          en: 'How do I run MiniMax H3 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 MiniMax H3？'
        },
        answer: {
          en: `Open a MiniMax workflow template, or add H3 to any workflow on the canvas. It runs on Comfy Cloud, so you do not need a local GPU. Follow [the MiniMax H3 workflow tutorial](${minimaxLinks.docs}) for a step-by-step walkthrough.`,
          'zh-CN': `打开 MiniMax 工作流模板，或将 H3 添加到画布上的任意工作流中。它在 Comfy Cloud 上运行，因此你不需要本地 GPU。分步教程请见[MiniMax H3 工作流文档](${minimaxLinks.docs})。`
        }
      }
    ]
  },
  closingCta: {
    headingKey: 'minimax.cta.heading',
    primaryCta: {
      labelKey: 'minimax.cta.primaryCta',
      href: minimaxLinks.cloudRun,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'minimax.cta.secondaryCta',
      href: minimaxLinks.imageToVideo,
      target: '_blank'
    }
  },
  runOptions: {
    headingKey: 'minimax.runOptions.heading',
    subtitleKey: 'minimax.runOptions.subtitle',
    ctaKey: 'minimax.runOptions.cta'
  },
  reviews: {
    headingKey: 'minimax.reviews.heading',
    highlight: {
      titleKey: 'minimax.reviews.highlightTitle',
      descriptionKey: 'minimax.reviews.highlightDescription',
      ctaKey: 'minimax.reviews.highlightCta',
      route: 'minimaxLicense'
    }
  }
} satisfies ModelLaunchPage
