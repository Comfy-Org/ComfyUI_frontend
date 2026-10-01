import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

const nanoBananaLinks = {
  cloud:
    'https://cloud.comfy.org/?utm_source=comfy.org&utm_medium=referral&utm_campaign=nano-banana',
  workflows: 'https://docs.comfy.org/tutorials/partner-nodes/google/nano-banana'
} as const

const placeholderMediaBase = 'https://media.comfy.org/website/chatgpt-image-2.5'

const media = {
  hero: {
    kind: 'video',
    src: `${placeholderMediaBase}/hero.mp4`,
    posterSrc: `${placeholderMediaBase}/hero-poster.webp`
  },
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

const premiumNote = { en: 'Pay-as-you-go', 'zh-CN': '按量付费' }

const showcaseAlt = (index: number) => ({
  en: `Placeholder style transfer example ${index} for Nano Banana`,
  'zh-CN': `Nano Banana 风格迁移占位示例 ${index}`
})

export const nanoBananaPage: ModelLaunchPage = {
  metaTitleKey: 'nanoBanana.meta.title',
  metaDescriptionKey: 'nanoBanana.meta.description',
  breadcrumbLabelKey: 'nanoBanana.breadcrumb.model',
  breadcrumbUpdatedKey: 'nanoBanana.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    mobileFallbackImageSrc: media.hero.posterSrc,
    mobileVideoSrc: `${placeholderMediaBase}/hero-mobile.mp4`,
    logoSrc: '/icons/ai-models/gemini.svg',
    titleKey: 'nanoBanana.hero.title',
    descriptionKey: 'nanoBanana.hero.description',
    badgeKeys: [
      'nanoBanana.hero.tagTextToImage',
      'nanoBanana.hero.tagImageEditing',
      'nanoBanana.hero.tagReferenceImages'
    ],
    primaryCta: {
      labelKey: 'nanoBanana.hero.primaryCta',
      href: nanoBananaLinks.cloud,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'nanoBanana.hero.secondaryCta',
      href: nanoBananaLinks.workflows,
      target: '_blank'
    }
  },
  showcase: {
    headingAccentKey: 'nanoBanana.showcase.headingAccent',
    headingKey: 'nanoBanana.showcase.heading',
    descriptionKey: 'nanoBanana.showcase.description',
    cards: [
      { id: 'style-1', alt: showcaseAlt(1), src: media.vaporwave.src },
      { id: 'style-2', alt: showcaseAlt(2), src: media.aliens.src },
      { id: 'style-3', alt: showcaseAlt(3), src: media.goldfish.src },
      { id: 'style-4', alt: showcaseAlt(4), src: media.engine.src },
      { id: 'style-5', alt: showcaseAlt(5), src: media.canyon.src },
      { id: 'style-6', alt: showcaseAlt(6), src: media.horizon.src }
    ]
  },
  gallery: {
    headingKey: 'nanoBanana.gallery.heading',
    ctaVariant: 'accent',
    cards: [
      {
        id: 'placeholder-vaporwave',
        name: {
          en: 'Placeholder gallery image 1 for Nano Banana',
          'zh-CN': 'Nano Banana 占位图库图片 1'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Placeholder. Swap for a Nano Banana render and its caption.',
          'zh-CN': '占位内容。请替换为 Nano Banana 生成结果及其说明。'
        },
        media: media.vaporwave,
        href: nanoBananaLinks.cloud
      },
      {
        id: 'placeholder-aliens',
        name: {
          en: 'Placeholder gallery image 2 for Nano Banana',
          'zh-CN': 'Nano Banana 占位图库图片 2'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Placeholder. Swap for a Nano Banana render and its caption.',
          'zh-CN': '占位内容。请替换为 Nano Banana 生成结果及其说明。'
        },
        media: media.aliens,
        href: nanoBananaLinks.cloud
      },
      {
        id: 'placeholder-goldfish',
        name: {
          en: 'Placeholder gallery image 3 for Nano Banana',
          'zh-CN': 'Nano Banana 占位图库图片 3'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Placeholder. Swap for a Nano Banana render and its caption.',
          'zh-CN': '占位内容。请替换为 Nano Banana 生成结果及其说明。'
        },
        media: media.goldfish,
        href: nanoBananaLinks.cloud
      },
      {
        id: 'placeholder-engine',
        name: {
          en: 'Placeholder gallery image 4 for Nano Banana',
          'zh-CN': 'Nano Banana 占位图库图片 4'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Placeholder. Swap for a Nano Banana render and its caption.',
          'zh-CN': '占位内容。请替换为 Nano Banana 生成结果及其说明。'
        },
        media: media.engine,
        href: nanoBananaLinks.cloud
      },
      {
        id: 'placeholder-canyon',
        name: {
          en: 'Placeholder gallery image 5 for Nano Banana',
          'zh-CN': 'Nano Banana 占位图库图片 5'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Placeholder. Swap for a Nano Banana render and its caption.',
          'zh-CN': '占位内容。请替换为 Nano Banana 生成结果及其说明。'
        },
        media: media.canyon,
        href: nanoBananaLinks.cloud
      },
      {
        id: 'placeholder-horizon',
        name: {
          en: 'Placeholder gallery image 6 for Nano Banana',
          'zh-CN': 'Nano Banana 占位图库图片 6'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Placeholder. Swap for a Nano Banana render and its caption.',
          'zh-CN': '占位内容。请替换为 Nano Banana 生成结果及其说明。'
        },
        media: media.horizon,
        href: nanoBananaLinks.cloud
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'nanoBanana.pricing.banner.title',
      subtitleKey: 'nanoBanana.pricing.banner.subtitle',
      cta: {
        labelKey: 'nanoBanana.pricing.banner.cta',
        href: nanoBananaLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'nanoBanana.faq.heading',
    items: [
      {
        id: 'what-is-nano-banana',
        question: {
          en: 'What is Nano Banana?',
          'zh-CN': 'Nano Banana 是什么？'
        },
        answer: {
          en: 'Nano Banana is a Google image model for generating new visuals and editing existing images from natural-language instructions. In ComfyUI, it runs through Partner Nodes and can be combined with the rest of your workflow.',
          'zh-CN':
            'Nano Banana 是 Google 的图像模型，可通过自然语言指令生成新视觉内容或编辑现有图像。在 ComfyUI 中，它通过合作伙伴节点运行，并可与工作流中的其他步骤组合。'
        }
      },
      {
        id: 'how-to-run',
        question: {
          en: 'How do I run Nano Banana in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 Nano Banana？'
        },
        answer: {
          en: `Open [Comfy Cloud](${nanoBananaLinks.cloud}), add the Google image Partner Node to a workflow, enter a prompt, and connect any reference images you want to use.`,
          'zh-CN': `打开 [Comfy Cloud](${nanoBananaLinks.cloud})，在工作流中添加 Google 图像合作伙伴节点，输入提示词，并连接需要使用的参考图像。`
        }
      },
      {
        id: 'image-editing',
        question: {
          en: 'Can Nano Banana edit an existing image?',
          'zh-CN': 'Nano Banana 可以编辑现有图像吗？'
        },
        answer: {
          en: 'Yes. Supply an image and describe the change you want, from replacing objects and restyling a scene to focused masked edits. You can keep the result in the same graph for further processing.',
          'zh-CN':
            '可以。提供图像并描述想要的改动，即可替换物体、重塑场景风格或进行局部蒙版编辑。结果可以留在同一图形中继续处理。'
        }
      },
      {
        id: 'reference-images',
        question: {
          en: 'Can I use reference images?',
          'zh-CN': '可以使用参考图像吗？'
        },
        answer: {
          en: 'Yes. Reference images can guide the subject, composition, materials, or visual language of a generation. Describe which qualities should carry into the result.',
          'zh-CN':
            '可以。参考图像能够引导生成结果的主体、构图、材质或视觉语言。请在提示词中说明希望保留哪些特征。'
        }
      },
      {
        id: 'prompting',
        question: {
          en: 'How should I prompt Nano Banana?',
          'zh-CN': '如何为 Nano Banana 编写提示词？'
        },
        answer: {
          en: 'Write a clear creative brief: name the subject, setting, composition, lighting, medium, and any text that must appear. For edits, state what should change and what must stay untouched.',
          'zh-CN':
            '像写创意简报一样清楚描述：主体、场景、构图、光线、媒介，以及必须出现的文字。进行编辑时，请说明哪些内容需要改变、哪些必须保持不变。'
        }
      },
      {
        id: 'comfy-workflows',
        question: {
          en: 'Why use Nano Banana in a ComfyUI workflow?',
          'zh-CN': '为什么要在 ComfyUI 工作流中使用 Nano Banana？'
        },
        answer: {
          en: 'The generated image becomes one step in a larger, repeatable pipeline. Route it into masking, compositing, upscaling, animation, or another model while keeping every step visible and adjustable.',
          'zh-CN':
            '生成的图像可以成为更大规模、可复用流程中的一步。你可以继续将它传入蒙版、合成、放大、动画或其他模型，同时让每个步骤都保持可见、可调。'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'nanoBanana.runOptions.heading',
    subtitleKey: 'nanoBanana.runOptions.subtitle',
    ctaKey: 'nanoBanana.runOptions.cta'
  },
  reviews: {
    headingKey: 'nanoBanana.reviews.heading',
    highlight: {
      titleKey: 'nanoBanana.reviews.highlightTitle',
      descriptionKey: 'nanoBanana.reviews.highlightDescription',
      ctaKey: 'nanoBanana.reviews.highlightCta'
    }
  }
}
