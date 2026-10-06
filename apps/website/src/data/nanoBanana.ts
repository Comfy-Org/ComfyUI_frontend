import type { ModelLaunchPage } from '@/templates/model-launch/types'

const nanoBananaLinks = {
  cloud:
    'https://cloud.comfy.org/?utm_source=comfy.org&utm_medium=referral&utm_campaign=nano-banana',
  workflows:
    'https://docs.comfy.org/tutorials/partner-nodes/google/nano-banana-2'
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
  },
  {
    slug: 'rain-cyclist',
    en: 'Cyclist splashing through a rain-soaked city street at dusk',
    'zh-CN': '黄昏时分骑行者溅水穿过雨后城市街道'
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
    slug: 'newspaper',
    en: 'Vintage newspaper front page on a wooden table',
    'zh-CN': '木桌上的复古报纸头版'
  },
  {
    slug: 'teapot',
    en: 'Terracotta teapot and cup on burlap in window light',
    'zh-CN': '窗边光线下麻布上的陶土茶壶与茶杯'
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
  stackBreadcrumbOnMobile: true,
  hero: {
    layout: 'media-first',
    titleKey: 'nanoBanana.hero.title',
    descriptionKey: 'nanoBanana.hero.description',
    badgeKeys: [
      'nanoBanana.hero.tagTextToImage',
      'nanoBanana.hero.tagImageEditing',
      'nanoBanana.hero.tagPartnerNode'
    ],
    primaryCta: {
      labelKey: 'nanoBanana.hero.primaryCta',
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
          en: 'What is Nano Banana 2.1?',
          'zh-CN': 'Nano Banana 2.1 是什么？'
        },
        answer: {
          en: "Nano Banana 2.1 is Google's newest Gemini image generation and editing model, and the successor to Nano Banana 2. Give it a prompt and optional reference images, and it returns a finished image at up to 4K.",
          'zh-CN':
            'Nano Banana 2.1 是 Google 最新的 Gemini 图像生成与编辑模型，也是 Nano Banana 2 的继任者。给它一个提示词和可选的参考图像，它就能返回最高 4K 分辨率的成品图像。'
        }
      },
      {
        id: 'whats-different',
        question: {
          en: "What's different from Nano Banana 2?",
          'zh-CN': '与 Nano Banana 2 有什么不同？'
        },
        answer: {
          en: 'There are two changes: a third thinking level and a lower cost per run. Aspect ratios and resolution tiers carry over, so it fits into your existing workflows in the same slot.',
          'zh-CN':
            '有两处变化：新增第三个思考等级，以及更低的单次运行成本。宽高比和分辨率档位保持不变，因此它可以在现有工作流中直接替换原来的位置。'
        }
      },
      {
        id: 'how-to-run',
        question: {
          en: 'How do I run Nano Banana 2.1 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 Nano Banana 2.1？'
        },
        answer: {
          en: `Update ComfyUI, double-click the canvas, and search for the Nano Banana 2.1 node, or open the workflow from the Template Library. If you'd rather install nothing, run it on [Comfy Cloud](${nanoBananaLinks.cloud}).`,
          'zh-CN': `更新 ComfyUI，双击画布并搜索 Nano Banana 2.1 节点，或从模板库中打开对应工作流。如果不想安装任何东西，可以在 [Comfy Cloud](${nanoBananaLinks.cloud}) 上运行。`
        }
      },
      {
        id: 'image-editing',
        question: {
          en: 'Can Nano Banana 2.1 edit an existing image?',
          'zh-CN': 'Nano Banana 2.1 可以编辑现有图像吗？'
        },
        answer: {
          en: 'Yes. Connect your image and describe the change. Recolors, material swaps, object removal, and text replacement leave the rest of the frame untouched. You can also edit by intent: ask for every metal object to become wood, and the model finds the right ones.',
          'zh-CN':
            '可以。连接你的图像并描述想要的改动。改色、材质替换、物体移除和文字替换都不会影响画面的其余部分。你也可以按意图编辑：要求把所有金属物体变成木质，模型会自动找到正确的对象。'
        }
      },
      {
        id: 'reference-images',
        question: {
          en: 'Can I use reference images?',
          'zh-CN': '可以使用参考图像吗？'
        },
        answer: {
          en: "Yes. Use them to guide characters, products, and garments. Character turnarounds and orthographic sheets hold costume, scale, and alignment across every panel. Virtual try-on keeps the subject's identity and pose intact.",
          'zh-CN':
            '可以。用它们来引导角色、产品和服装。角色转面图和正交视图表能在每个面板中保持服装、比例和对齐一致。虚拟试穿则会完整保留人物的身份和姿势。'
        }
      },
      {
        id: 'prompting',
        question: {
          en: 'How should I prompt Nano Banana 2.1?',
          'zh-CN': '如何为 Nano Banana 2.1 编写提示词？'
        },
        answer: {
          en: 'Write it like a brief, and spell out every word you want rendered in the image. Name a style to get real stylization. For thinking levels, use Minimal to explore, High for dense layouts or stacked constraints, and Medium in between. Higher levels take longer and use more tokens.',
          'zh-CN':
            '像写创意简报一样，并逐字写出你希望在图像中呈现的所有文字。指定一种风格即可获得真正的风格化效果。思考等级方面，用 Minimal 来探索，用 High 处理密集排版或多重约束，Medium 介于两者之间。等级越高，耗时越长，消耗的 token 也越多。'
        }
      },
      {
        id: 'comfy-workflows',
        question: {
          en: 'Why use Nano Banana 2.1 in a ComfyUI workflow?',
          'zh-CN': '为什么要在 ComfyUI 工作流中使用 Nano Banana 2.1？'
        },
        answer: {
          en: 'The model is one step, not the whole job. Chain it with upscalers, other partner models, and your own nodes, then rerun with one parameter changed. Every step stays visible and repeatable.',
          'zh-CN':
            '模型只是其中一步，而不是整个任务。将它与放大器、其他合作伙伴模型以及你自己的节点串联起来，然后只改一个参数重新运行。每一步都保持可见、可复用。'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'nanoBanana.runOptions.heading',
    subtitleKey: 'nanoBanana.runOptions.subtitle',
    ctaKey: 'nanoBanana.runOptions.cta'
  },
  sectionOrder: ['showcases', 'faq', 'pricing'],
  reviews: {
    headingKey: 'nanoBanana.reviews.heading'
  }
}
