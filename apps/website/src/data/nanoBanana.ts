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
  runOptions: {
    headingKey: 'nanoBanana.runOptions.heading',
    subtitleKey: 'nanoBanana.runOptions.subtitle',
    ctaKey: 'nanoBanana.runOptions.cta'
  },
  sectionOrder: ['showcases', 'pricing'],
  reviews: {
    headingKey: 'nanoBanana.reviews.heading'
  }
}
