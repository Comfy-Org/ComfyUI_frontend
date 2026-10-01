import type { ModelLaunchPage } from '../templates/model-launch/types'

const nanoBananaLinks = {
  cloud:
    'https://cloud.comfy.org/?utm_source=comfy.org&utm_medium=referral&utm_campaign=nano-banana',
  workflows: 'https://docs.comfy.org/tutorials/partner-nodes/google/nano-banana'
} as const

interface LocalStill {
  slug: string
  en: string
  'zh-CN': string
}

const localCards = (theme: string, stills: readonly LocalStill[]) =>
  stills.map(({ slug, ...alt }) => ({
    id: `${theme}-${slug}`,
    alt,
    src: `/images/nano-banana/${theme}-${slug}.webp`
  }))

const photographyCards = localCards('photography', [
  {
    slug: 'fruit-still-life',
    en: 'Still life of grapes, pears, and lemons in a stoneware bowl',
    'zh-CN': '陶碗中葡萄、梨与柠檬的静物'
  },
  {
    slug: 'dark-kitchen',
    en: 'Empty commercial kitchen at night',
    'zh-CN': '夜晚空无一人的商用厨房'
  },
  {
    slug: 'glass-of-water',
    en: 'Glass of water on a folded newspaper',
    'zh-CN': '折叠报纸上的一杯水'
  },
  {
    slug: 'street-market',
    en: 'Shoppers at a busy street market',
    'zh-CN': '热闹街市中的顾客'
  },
  {
    slug: 'octopus',
    en: 'Octopus swimming beneath sunlit water',
    'zh-CN': '在阳光穿透的海水中游动的章鱼'
  }
])

const designCards = localCards('design', [
  {
    slug: 'lake-photo',
    en: 'Mountain lake at dawn as a photograph',
    'zh-CN': '黎明山间湖泊的照片'
  },
  {
    slug: 'lake-woodblock',
    en: 'Mountain lake at dawn as a woodblock print',
    'zh-CN': '黎明山间湖泊的木版画'
  },
  {
    slug: 'ink-wash',
    en: 'Fox and lantern as an ink wash painting',
    'zh-CN': '水墨画风格的狐狸与灯笼'
  },
  {
    slug: 'claymation',
    en: 'Fox and lantern as a claymation forest scene',
    'zh-CN': '黏土动画风格的狐狸与灯笼森林场景'
  },
  {
    slug: 'art-nouveau',
    en: 'Fox and lantern as an art nouveau poster',
    'zh-CN': '新艺术风格海报中的狐狸与灯笼'
  },
  {
    slug: 'blueprint',
    en: 'Fox and lantern as an annotated blueprint',
    'zh-CN': '带标注的蓝图风格狐狸与灯笼'
  },
  {
    slug: 'stained-glass',
    en: 'Fox and lantern as a stained glass window',
    'zh-CN': '彩绘玻璃窗风格的狐狸与灯笼'
  }
])

const advertisingCards = localCards('advertising', [
  {
    slug: 'spicy-mayo',
    en: 'Spicy mayo squeeze bottle on a kitchen table with burgers and fries',
    'zh-CN': '厨房餐桌上的辣味蛋黄酱挤压瓶，旁边是汉堡和薯条'
  },
  {
    slug: 'estate-car',
    en: 'Grey estate car in a dark studio',
    'zh-CN': '暗色影棚中的灰色旅行车'
  },
  {
    slug: 'teapot',
    en: 'Terracotta teapot and cup on burlap in window light',
    'zh-CN': '窗边光线下麻布上的陶土茶壶与茶杯'
  },
  {
    slug: 'newspaper',
    en: 'Vintage newspaper front page on a wooden table',
    'zh-CN': '木桌上的复古报纸头版'
  },
  {
    slug: 'botanical-bottles',
    en: 'Three amber botanical extract bottles with coloured caps',
    'zh-CN': '三瓶带彩色瓶盖的琥珀色植物萃取液'
  },
  {
    slug: 'ramen',
    en: 'Steaming bowl of ramen with chopsticks on a wooden table',
    'zh-CN': '木桌上冒着热气的拉面与筷子'
  },
  {
    slug: 'gallery-building',
    en: 'Black timber gallery building under an overcast sky',
    'zh-CN': '阴天下的黑色木质画廊建筑'
  },
  {
    slug: 'mayo-box',
    en: 'Mayo carton with hand-drawn packaging on a wooden counter',
    'zh-CN': '木质台面上手绘包装的蛋黄酱纸盒'
  },
  {
    slug: 'leather-zipper',
    en: 'Close-up of a brass zipper on tan leather',
    'zh-CN': '棕色皮革上黄铜拉链的特写'
  }
])

export const nanoBananaPage: ModelLaunchPage = {
  metaTitleKey: 'nanoBanana.meta.title',
  metaDescriptionKey: 'nanoBanana.meta.description',
  breadcrumbLabelKey: 'nanoBanana.breadcrumb.model',
  breadcrumbUpdatedKey: 'nanoBanana.breadcrumb.updated',
  hero: {
    layout: 'media-first',
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
  showcases: [
    {
      headingKey: 'nanoBanana.showcase.photography.heading',
      descriptionKey: 'nanoBanana.showcase.photography.description',
      cards: photographyCards
    },
    {
      headingKey: 'nanoBanana.showcase.design.heading',
      descriptionKey: 'nanoBanana.showcase.design.description',
      cards: designCards
    },
    {
      headingKey: 'nanoBanana.showcase.advertising.heading',
      descriptionKey: 'nanoBanana.showcase.advertising.description',
      cards: advertisingCards
    }
  ],
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
  highlight: {
    titleKey: 'nanoBanana.reviews.highlightTitle',
    descriptionKey: 'nanoBanana.reviews.highlightDescription',
    ctaKey: 'nanoBanana.reviews.highlightCta'
  },
  reviews: {
    headingKey: 'nanoBanana.reviews.heading'
  }
}
