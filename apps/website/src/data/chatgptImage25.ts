import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

const chatgptImage25Links = {
  cloud:
    'https://cloud.comfy.org/?template=api_openai_gpt_image_25_flare_t2i&utm_source=comfy.org&utm_medium=referral&utm_campaign=gpt-image-2-5',
  workflows:
    'https://docs.comfy.org/tutorials/partner-nodes/openai/gpt-image-2-5'
} as const

const mediaBase = 'https://media.comfy.org/website/chatgpt-image-2.5'

const media = {
  hero: {
    kind: 'video',
    src: `${mediaBase}/hero.mp4`,
    posterSrc: `${mediaBase}/hero-poster.webp`
  },
  vaporwave: { kind: 'image', src: `${mediaBase}/vaporwave.webp` },
  aliens: {
    kind: 'image',
    src: `${mediaBase}/alien-convenience-store.webp`
  },
  goldfish: { kind: 'image', src: `${mediaBase}/goldfish.webp` },
  engine: { kind: 'image', src: `${mediaBase}/flame-engine.webp` },
  canyon: { kind: 'image', src: `${mediaBase}/canyon-chase.webp` },
  horizon: { kind: 'image', src: `${mediaBase}/anime-horizon.webp` }
} as const satisfies Record<string, ModelLaunchMedia>

const premiumNote = { en: 'Pay-as-you-go', 'zh-CN': '按量付费' }

export const chatgptImage25Page: ModelLaunchPage = {
  metaTitleKey: 'chatgptImage25.meta.title',
  metaDescriptionKey: 'chatgptImage25.meta.description',
  breadcrumbLabelKey: 'chatgptImage25.breadcrumb.model',
  breadcrumbUpdatedKey: 'chatgptImage25.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    mobileFallbackImageSrc: media.hero.posterSrc,
    mobileVideoSrc: `${mediaBase}/hero-mobile.mp4`,
    logoSrc: '/icons/ai-models/openai.svg',
    titleKey: 'chatgptImage25.hero.title',
    descriptionKey: 'chatgptImage25.hero.description',
    badgeKeys: [
      'chatgptImage25.hero.tagTextToImage',
      'chatgptImage25.hero.tagImageEditing',
      'chatgptImage25.hero.tagReferenceImages'
    ],
    primaryCta: {
      labelKey: 'chatgptImage25.hero.primaryCta',
      href: chatgptImage25Links.cloud,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'chatgptImage25.hero.secondaryCta',
      href: chatgptImage25Links.workflows,
      target: '_blank'
    }
  },
  gallery: {
    headingKey: 'chatgptImage25.gallery.heading',
    ctaVariant: 'accent',
    cards: [
      {
        id: 'vaporwave-atmosphere',
        name: {
          en: 'Vaporwave architecture generated with ChatGPT Images 2.5',
          'zh-CN': '使用 ChatGPT Images 2.5 生成的蒸汽波建筑场景'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A polished vaporwave world with crisp typography, reflective marble, and neon light.',
          'zh-CN': '精致的蒸汽波世界，融合清晰文字、反光大理石与霓虹光影。'
        },
        media: media.vaporwave,
        href: chatgptImage25Links.cloud
      },
      {
        id: 'alien-convenience-store',
        name: {
          en: 'Aliens in a convenience store generated with ChatGPT Images 2.5',
          'zh-CN': '使用 ChatGPT Images 2.5 生成的便利店外星人场景'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A deadpan security-camera frame of four sharply dressed visitors from another world.',
          'zh-CN': '便利店监控镜头下，四位衣着考究的外星来客冷面出镜。'
        },
        media: media.aliens,
        href: chatgptImage25Links.cloud
      },
      {
        id: 'goldfish-fisheye',
        name: {
          en: 'Goldfish in a glass bowl generated with ChatGPT Images 2.5',
          'zh-CN': '使用 ChatGPT Images 2.5 生成的玻璃鱼缸金鱼场景'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A curious goldfish meets an extreme fisheye lens in a sunlit field.',
          'zh-CN': '阳光草地上，好奇的金鱼遇见极致鱼眼镜头。'
        },
        media: media.goldfish,
        href: chatgptImage25Links.cloud
      },
      {
        id: 'flame-engine',
        name: {
          en: 'Flaming engine watercolor generated with ChatGPT Images 2.5',
          'zh-CN': '使用 ChatGPT Images 2.5 生成的火焰引擎水彩画'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A roaring V8 rendered as an expressive watercolor study in heat and motion.',
          'zh-CN': '咆哮的 V8 引擎化作充满热浪与动势的水彩习作。'
        },
        media: media.engine,
        href: chatgptImage25Links.cloud
      },
      {
        id: 'canyon-chase',
        name: {
          en: 'Canyon car chase generated with ChatGPT Images 2.5',
          'zh-CN': '使用 ChatGPT Images 2.5 生成的峡谷飞车追逐场景'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A cinematic canyon pursuit freezes at the instant a muscle car clears the gap.',
          'zh-CN': '电影感峡谷追逐，在肌肉车飞越断崖的一刻定格。'
        },
        media: media.canyon,
        href: chatgptImage25Links.cloud
      },
      {
        id: 'anime-horizon',
        name: {
          en: 'Anime hero at a red horizon generated with ChatGPT Images 2.5',
          'zh-CN': '使用 ChatGPT Images 2.5 生成的红日地平线动画场景'
        },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A solitary hero watches a red sun rise over a restrained anime landscape.',
          'zh-CN': '孤独的英雄凝望红日，从克制的动画风景中升起。'
        },
        media: media.horizon,
        href: chatgptImage25Links.cloud
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'chatgptImage25.pricing.banner.title',
      subtitleKey: 'chatgptImage25.pricing.banner.subtitle',
      cta: {
        labelKey: 'chatgptImage25.pricing.banner.cta',
        href: chatgptImage25Links.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'chatgptImage25.faq.heading',
    items: [
      {
        id: 'what-is-chatgpt-image-2-5',
        question: {
          en: 'What is ChatGPT Images 2.5?',
          'zh-CN': 'ChatGPT Images 2.5 是什么？'
        },
        answer: {
          en: 'ChatGPT Images 2.5 is an OpenAI image model for generating new visuals and editing existing images from natural-language instructions. In ComfyUI, it runs through Partner Nodes and can be combined with the rest of your workflow.',
          'zh-CN':
            'ChatGPT Images 2.5 是 OpenAI 的图像模型，可通过自然语言指令生成新视觉内容或编辑现有图像。在 ComfyUI 中，它通过合作伙伴节点运行，并可与工作流中的其他步骤组合。'
        }
      },
      {
        id: 'how-to-run',
        question: {
          en: 'How do I run ChatGPT Images 2.5 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 ChatGPT Images 2.5？'
        },
        answer: {
          en: `Open [Comfy Cloud](${chatgptImage25Links.cloud}), add the OpenAI image Partner Node to a workflow, enter a prompt, and connect any reference images you want to use.`,
          'zh-CN': `打开 [Comfy Cloud](${chatgptImage25Links.cloud})，在工作流中添加 OpenAI 图像合作伙伴节点，输入提示词，并连接需要使用的参考图像。`
        }
      },
      {
        id: 'image-editing',
        question: {
          en: 'Can ChatGPT Images 2.5 edit an existing image?',
          'zh-CN': 'ChatGPT Images 2.5 可以编辑现有图像吗？'
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
          en: 'How should I prompt ChatGPT Images 2.5?',
          'zh-CN': '如何为 ChatGPT Images 2.5 编写提示词？'
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
          en: 'Why use ChatGPT Images 2.5 in a ComfyUI workflow?',
          'zh-CN': '为什么要在 ComfyUI 工作流中使用 ChatGPT Images 2.5？'
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
    headingKey: 'chatgptImage25.runOptions.heading',
    subtitleKey: 'chatgptImage25.runOptions.subtitle',
    ctaKey: 'chatgptImage25.runOptions.cta'
  },
  reviews: {
    headingKey: 'chatgptImage25.reviews.heading',
    highlight: {
      titleKey: 'chatgptImage25.reviews.highlightTitle',
      descriptionKey: 'chatgptImage25.reviews.highlightDescription',
      ctaKey: 'chatgptImage25.reviews.highlightCta'
    }
  }
}
