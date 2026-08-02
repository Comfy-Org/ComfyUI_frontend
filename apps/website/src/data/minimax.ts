import type { LocalizedText, TranslationKey } from '../i18n/translations'
import type { PlanFeatureGroup } from './pricingPlans'

import { externalLinks } from '../config/routes'

// MiniMax H3 (Hailuo 3) media, served from media.comfy.org.
// hero + the four scene clips are real H3 renders under website/minimax/. The
// two `example` stills reuse existing shared assets for the steps/showcase
// sections, which stay gated off (showPlaceholderMediaSections) until final art.
const media = {
  hero: 'https://media.comfy.org/website/minimax/hero.mp4',
  iceRider: 'https://media.comfy.org/website/minimax/ice-rider.webm',
  sunkenTemple: 'https://media.comfy.org/website/minimax/sunken-temple.webm',
  nightAscent: 'https://media.comfy.org/website/minimax/night-ascent.webm',
  fluid: 'https://media.comfy.org/website/minimax/fluid.webm',
  example1:
    'https://media.comfy.org/website/cloud/ai-models/nano-banana-pro.webp',
  example2:
    'https://media.comfy.org/website/cloud/ai-models/qwen-image-edit.webp'
} as const

export const minimaxHeroVideo = media.hero

export interface MiniMaxStep {
  id: string
  title: LocalizedText
  description: LocalizedText
  imageSrc: string
}

export const minimaxSteps: readonly MiniMaxStep[] = [
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
    id: 'switch-to-minimax',
    title: { en: 'Switch to MiniMax H3', 'zh-CN': '切换到 MiniMax H3' },
    description: {
      en: 'Final render, up to 2K',
      'zh-CN': '最终渲染，最高 2K'
    },
    imageSrc: media.example1
  }
] as const

type MiniMaxModelTier = 'free' | 'premium'

export interface MiniMaxModel {
  id: string
  name: string
  tier: MiniMaxModelTier
  note: LocalizedText
  description: LocalizedText
  imageSrc: string
  logoSrc: string
  logoAlt: string
  href: string
}

// Four real MiniMax H3 renders shown as a showcase grid. They are all one model,
// so the cards carry no per-model logo (logoSrc is empty, chip hidden) and the
// tier tag simply marks H3 as a premium model.
export const minimaxModels: readonly MiniMaxModel[] = [
  {
    id: 'ice-rider',
    name: 'Ice canyon rider',
    tier: 'premium',
    note: { en: 'Text to video', 'zh-CN': '文本生成视频' },
    description: {
      en: 'A lone rider crosses a glacial canyon in one continuous move, camera and native audio straight out of H3.',
      'zh-CN': '骑手一镜到底穿越冰川峡谷，运镜与原生音频均由 H3 直接生成。'
    },
    imageSrc: media.iceRider,
    logoSrc: '',
    logoAlt: 'MiniMax H3',
    href: externalLinks.workflows
  },
  {
    id: 'sunken-temple',
    name: 'Sunken temple',
    tier: 'premium',
    note: { en: 'Text to video', 'zh-CN': '文本生成视频' },
    description: {
      en: 'God-rays drift through a flooded temple of carved gold, holding light and depth steady across the whole shot.',
      'zh-CN': '光束穿过被水淹没的黄金浮雕神殿，全程保持光影与景深的稳定。'
    },
    imageSrc: media.sunkenTemple,
    logoSrc: '',
    logoAlt: 'MiniMax H3',
    href: externalLinks.workflows
  },
  {
    id: 'night-ascent',
    name: 'Night ascent',
    tier: 'premium',
    note: { en: 'Text to video', 'zh-CN': '文本生成视频' },
    description: {
      en: 'A headlamped climber pushes up a moonlit dune, fine grain and motion kept clean in near-dark.',
      'zh-CN': '头灯登山者攀上月光沙丘，近乎全黑的画面中颗粒与运动依旧干净。'
    },
    imageSrc: media.nightAscent,
    logoSrc: '',
    logoAlt: 'MiniMax H3',
    href: externalLinks.workflows
  },
  {
    id: 'liquid-chrome',
    name: 'Liquid chrome',
    tier: 'premium',
    note: { en: 'Text to video', 'zh-CN': '文本生成视频' },
    description: {
      en: 'A chrome fluid ripples under teal and amber light, a stress test for reflection and micro-detail.',
      'zh-CN':
        '青与琥珀光下的液态铬面泛起涟漪，是对反射与微观细节的一次压力测试。'
    },
    imageSrc: media.fluid,
    logoSrc: '',
    logoAlt: 'MiniMax H3',
    href: externalLinks.workflows
  }
] as const

export interface MiniMaxExample {
  id: string
  prompt: LocalizedText
  imageSrc: string
  imageAlt: LocalizedText
}

// Prompt/result pairs are placeholder pending final examples. The showcase
// section stays gated off until real MiniMax renders land.
export const minimaxExamples: readonly MiniMaxExample[] = [
  {
    id: 'dalmatian-loft',
    prompt: {
      en: 'A dalmatian stretches across a sunlit loft, slow push-in, shallow depth of field, warm morning light.',
      'zh-CN':
        '一只斑点狗在洒满阳光的阁楼里舒展身体，镜头缓缓推进，浅景深，温暖的晨光。'
    },
    imageSrc: media.example1,
    imageAlt: {
      en: 'MiniMax render of a dalmatian in a sunlit loft',
      'zh-CN': 'MiniMax 渲染的阁楼斑点狗画面'
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
      en: 'MiniMax render of a rain-streaked city window at dusk',
      'zh-CN': 'MiniMax 渲染的黄昏雨窗画面'
    }
  },
  {
    id: 'studio-portrait',
    prompt: {
      en: 'Slow orbit around a model on a seamless studio backdrop, soft key light, subtle rim, editorial motion.',
      'zh-CN':
        '镜头缓缓环绕纯色背景前的模特，柔和主光，微妙轮廓光，时尚编辑感的运镜。'
    },
    imageSrc: media.example1,
    imageAlt: {
      en: 'MiniMax render of a studio portrait orbit',
      'zh-CN': 'MiniMax 渲染的影棚人像环绕画面'
    }
  },
  {
    id: 'street-tracking',
    prompt: {
      en: 'Tracking shot following a runner through a neon night market, shallow focus, motion blur, moody grade.',
      'zh-CN': '跟拍镜头追随一名跑者穿过霓虹夜市，浅焦，动态模糊，情绪化调色。'
    },
    imageSrc: media.example2,
    imageAlt: {
      en: 'MiniMax render of a runner in a neon night market',
      'zh-CN': 'MiniMax 渲染的霓虹夜市跑者画面'
    }
  }
] as const

export interface MiniMaxPricingPlan {
  id: 'standard' | 'creator' | 'pro'
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  priceKey: TranslationKey
  yearlyPriceKey: TranslationKey
  yearlyTotalKey: TranslationKey
  creditsKey: TranslationKey
  estimateKey: TranslationKey
  ctaKey: TranslationKey
  featureGroups: PlanFeatureGroup[]
  isPopular?: boolean
}

// Minimax-specific pricing presentation: same plans, prices, and subscribe
// URLs as the shared PricingSection, with per-plan descriptions and
// "Everything in X, plus:" feature groups.
export const minimaxPricingPlans: readonly MiniMaxPricingPlan[] = [
  {
    id: 'standard',
    labelKey: 'pricing.plan.standard.label',
    descriptionKey: 'minimax.pricing.plan.standard.description',
    priceKey: 'pricing.plan.standard.price',
    yearlyPriceKey: 'pricing.plan.standard.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.standard.yearlyTotal',
    creditsKey: 'pricing.plan.standard.credits',
    estimateKey: 'minimax.pricing.plan.standard.estimate',
    ctaKey: 'pricing.plan.standard.cta',
    featureGroups: [
      {
        features: [
          { text: 'minimax.pricing.feature.runtime30' },
          { text: 'pricing.feature.addCredits' }
        ]
      }
    ]
  },
  {
    id: 'creator',
    labelKey: 'pricing.plan.creator.label',
    descriptionKey: 'minimax.pricing.plan.creator.description',
    priceKey: 'pricing.plan.creator.price',
    yearlyPriceKey: 'pricing.plan.creator.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.creator.yearlyTotal',
    creditsKey: 'pricing.plan.creator.credits',
    estimateKey: 'minimax.pricing.plan.creator.estimate',
    ctaKey: 'pricing.plan.creator.cta',
    featureGroups: [
      {
        titleKey: 'minimax.pricing.everythingInStandard',
        features: [
          { text: 'minimax.pricing.feature.loras' },
          { text: 'minimax.pricing.feature.apiJobs3' }
        ]
      }
    ],
    isPopular: true
  },
  {
    id: 'pro',
    labelKey: 'pricing.plan.pro.label',
    descriptionKey: 'minimax.pricing.plan.pro.description',
    priceKey: 'pricing.plan.pro.price',
    yearlyPriceKey: 'pricing.plan.pro.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.pro.yearlyTotal',
    creditsKey: 'pricing.plan.pro.credits',
    estimateKey: 'minimax.pricing.plan.pro.estimate',
    ctaKey: 'pricing.plan.pro.cta',
    featureGroups: [
      {
        titleKey: 'minimax.pricing.everythingInCreator',
        features: [
          { text: 'minimax.pricing.feature.longRuntime' },
          { text: 'minimax.pricing.feature.apiJobs5' }
        ]
      }
    ]
  }
] as const

export interface MiniMaxFaq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

// TODO: confirm FAQ copy — the Figma FAQ was lorem ipsum. These answers are
// drafted to stay factual to the hero copy (open weights, multi-modal I/O,
// native stereo audio, up to 2K, 5–15s per generation, conditions on input
// audio, the open release of Hailuo 3.0).
export const minimaxFaqs: readonly MiniMaxFaq[] = [
  {
    id: 'what-is-minimax',
    question: {
      en: 'What is MiniMax H3 (Hailuo 3)?',
      'zh-CN': 'MiniMax H3（Hailuo 3）是什么？'
    },
    answer: {
      en: "MiniMax's video model, released as the open weights of Hailuo 3.0. It takes text, image, or audio in and renders a clip with native stereo audio. On Comfy you direct it on the canvas alongside every other model.",
      'zh-CN':
        'MiniMax 的视频模型，以 Hailuo 3.0 的开源权重形式发布。它支持文本、图像或音频输入，并渲染出带原生立体声音频的片段。在 Comfy 上，你可以在画布上与其他模型一起执导它。'
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
      en: 'Is MiniMax H3 open weights?',
      'zh-CN': 'MiniMax H3 是开源权重吗？'
    },
    answer: {
      en: 'Yes. H3 is the open release of Hailuo 3.0, so you can run the weights yourself.',
      'zh-CN':
        '是的。H3 是 Hailuo 3.0 的开源发布版本，因此你可以自行运行其权重。'
    }
  },
  {
    id: 'run-in-comfyui',
    question: {
      en: 'How do I run MiniMax H3 in ComfyUI?',
      'zh-CN': '如何在 ComfyUI 中运行 MiniMax H3？'
    },
    answer: {
      en: 'Open a MiniMax workflow template, or add H3 to any workflow on the canvas. It runs on Comfy Cloud, so you do not need a local GPU.',
      'zh-CN':
        '打开 MiniMax 工作流模板，或将 H3 添加到画布上的任意工作流中。它在 Comfy Cloud 上运行，因此你不需要本地 GPU。'
    }
  }
] as const

export interface MiniMaxReview {
  id: string
  body: LocalizedText
  name: string
  role?: LocalizedText
}

// Shared Comfy creator testimonials (identical to the Seedance page). These
// praise Comfy/ComfyUI generally, so they apply equally to MiniMax H3.
export const minimaxReviews: readonly MiniMaxReview[] = [
  {
    id: 'scott-belsky',
    body: {
      en: 'Comfy has innovated a new and powerful ecosystem for creativity without compromising creative control. It has been amazing to watch technical artists and curious creative minds leverage Comfy to explore the full surface area of their ideas.',
      'zh-CN':
        'Comfy 打造了一个全新而强大的创意生态，同时毫不牺牲创作掌控力。看着技术型艺术家和充满好奇的创意人借助 Comfy 探索创意的每一个维度，令人惊叹。'
    },
    name: 'Scott Belsky',
    role: { en: 'Founder of Behance', 'zh-CN': 'Behance 创始人' }
  },
  {
    id: 'richard-n',
    body: {
      en: 'The best part for me is the node-based workflow: it offers a lot of possibilities and enables many different combinations. I also appreciate the optimization options and the automatic memory handling, even when working with tight models.',
      'zh-CN':
        '对我来说最棒的是基于节点的工作流：它带来了大量可能性，能实现许多不同的组合。我也很欣赏它的优化选项和自动显存管理，即使在显存吃紧时也能应对。'
    },
    name: 'Richard N.',
    role: { en: 'Owner', 'zh-CN': '企业主' }
  },
  {
    id: 'maryann-e',
    body: {
      en: 'I appreciate being able to use models that my computer can no longer keep up with. I prefer the node-based approach because it is adjustable, rather than being behind a closed door.',
      'zh-CN':
        '我很喜欢能够使用那些本地电脑已经带不动的模型。我更偏爱基于节点的方式，因为它可以自由调整，而不是被关在一扇关闭的门后。'
    },
    name: 'MaryAnn E.',
    role: { en: "Broker at Pop RV's", 'zh-CN': "Pop RV's 经纪人" }
  },
  {
    id: 'alan-m',
    body: {
      en: 'The UI and UX of ComfyUI are intuitive and user-friendly, making navigation straightforward and efficient. Its integrations with other tools streamline workflows and enhance overall productivity.',
      'zh-CN':
        'ComfyUI 的界面和交互直观易用，导航清晰高效。它与其他工具的集成让工作流更顺畅，整体效率也随之提升。'
    },
    name: 'Alan M.',
    role: { en: 'Co-Founder', 'zh-CN': '联合创始人' }
  },
  {
    id: 'kirk-h',
    body: {
      en: "I use ComfyUI to help me create VFX for my animated show. It's easy to use, especially with importing a Comfy pipeline on the cloud, and I really like the clean UI and how straightforward it is.",
      'zh-CN':
        '我用 ComfyUI 为我的动画剧集制作视觉特效。它很好上手，尤其是在云端导入 Comfy 流程时，我非常喜欢它简洁直观的界面。'
    },
    name: 'Kirk H.'
  },
  {
    id: 'fred-c',
    body: {
      en: 'I love that ComfyUI is extremely fast and very reliable. It gives me so much freedom to create the characters I want.',
      'zh-CN':
        '我喜欢 ComfyUI 既极快又非常可靠。它让我可以自由地创作出想要的角色。'
    },
    name: 'Fred C.'
  },
  {
    id: 'matthew-p',
    body: {
      en: "The one-click workflows are something I do love, as they simplify many processes for me. The setup was very easy, even for someone who isn't familiar with it all.",
      'zh-CN':
        '我很喜欢一键式工作流，它为我简化了许多流程。整个设置也非常简单，即使对不太熟悉的人也是如此。'
    },
    name: 'Matthew P.'
  },
  {
    id: 'verified-user-in-depth',
    body: {
      en: "I like how in-depth ComfyUI can be. It makes me feel like the software itself isn't limited, which encourages me to keep experimenting and learning.",
      'zh-CN':
        '我喜欢 ComfyUI 可以做到多么深入。它让我觉得软件本身没有边界，鼓励我不断尝试和学习。'
    },
    name: 'Verified User'
  },
  {
    id: 'nikolai-k',
    body: {
      en: 'A holistic approach and visualisation through an endless whiteboard.',
      'zh-CN': '一种整体性的方式，通过无限画布进行可视化。'
    },
    name: 'Nikolai K.',
    role: { en: '3D Artist', 'zh-CN': '3D 艺术家' }
  },
  {
    id: 'leonardo-s',
    body: {
      en: 'Having full control of the GenAI process, and being able to use it unlimited times, integrating it into your workflow whenever you need to create.',
      'zh-CN':
        '能够完全掌控生成式 AI 的过程，并且可以无限次使用，随时将它融入到你的创作工作流中。'
    },
    name: 'Leonardo S.',
    role: {
      en: 'Social Media Marketing Expert',
      'zh-CN': '社交媒体营销专家'
    }
  },
  {
    id: 'verified-user-local',
    body: {
      en: 'Helps me run AI models locally and generate images, video, and audio, all free of cost.',
      'zh-CN': '帮助我在本地运行 AI 模型，并免费生成图像、视频和音频。'
    },
    name: 'Verified User',
    role: { en: 'Computer Software', 'zh-CN': '计算机软件' }
  }
] as const
