import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const ltxLinks = {
  cloudRun: 'https://cloud.comfy.org/?template=video_ltx2_5_i2v',
  cloudRunPremium: 'https://cloud.comfy.org/?template=api_ltx2_5_flf2v',
  hubModel: `${externalLinks.workflows}/model/ltx`
} as const

const media = {
  hero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/hero.mp4',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/hero-poster.webp'
  },
  blackbird: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-1.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-1.webp'
  },
  circuitry: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-2.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-2.webp'
  },
  portrait: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-3.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-3.webp'
  },
  drones: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-4.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-4.webp'
  },
  astronaut: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-5.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-5.webp'
  },
  horseman: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-6.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-6.webp'
  }
} as const satisfies Record<string, ModelLaunchMedia>

const freeNote = { en: 'Included free', 'zh-CN': '免费包含' }
const premiumNote = { en: 'Pay-as-you-go', 'zh-CN': '按量付费' }
const modelName = { en: 'LTX 2.5', 'zh-CN': 'LTX 2.5' }

export const ltxPage: ModelLaunchPage = {
  metaTitleKey: 'ltx.meta.title',
  metaDescriptionKey: 'ltx.meta.description',
  breadcrumbLabelKey: 'ltx.breadcrumb.model',
  breadcrumbUpdatedKey: 'ltx.breadcrumb.updated',
  hero: {
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    titleKey: 'ltx.hero.title',
    descriptionKey: 'ltx.hero.description',
    primaryCta: {
      labelKey: 'ltx.hero.primaryCta',
      href: ltxLinks.cloudRun,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'ltx.hero.secondaryCta',
      href: ltxLinks.hubModel,
      target: '_blank'
    },
    badgeKeys: [
      'ltx.hero.tagOpenSource',
      'ltx.hero.tagImageToVideo',
      'ltx.hero.tagTextToVideo',
      'ltx.hero.tagPartnerNode'
    ]
  },
  gallery: {
    headingKey: 'ltx.models.heading',
    cards: [
      {
        id: 'blackbird',
        name: modelName,
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A fighter jet banks hard over a stormy, moonlit sea.',
          'zh-CN': '战斗机在月光下的风暴海面上急转倾斜。'
        },
        media: media.blackbird,
        href: ltxLinks.cloudRun
      },
      {
        id: 'circuitry',
        name: modelName,
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Luminous figure drinks from a flower-filled glass.',
          'zh-CN': '发光的人像举起插着白花的玻璃杯饮下。'
        },
        media: media.circuitry,
        href: ltxLinks.cloudRun
      },
      {
        id: 'portrait',
        name: modelName,
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A weathered face stares out from deep shadow.',
          'zh-CN': '饱经风霜的面孔从深深的阴影中凝视。'
        },
        media: media.portrait,
        href: ltxLinks.cloudRun
      },
      {
        id: 'drones',
        name: modelName,
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Heavy-lift drones haul goats across a misty mountain range.',
          'zh-CN': '重型无人机吊运山羊飞越雾气缭绕的山脉。'
        },
        media: media.drones,
        href: ltxLinks.cloudRun
      },
      {
        id: 'astronaut',
        name: modelName,
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A frost-covered astronaut gazes up at the aurora.',
          'zh-CN': '覆霜的宇航员仰望极光。'
        },
        media: media.astronaut,
        href: ltxLinks.cloudRunPremium
      },
      {
        id: 'horseman',
        name: modelName,
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A coated rider and horse stand atop the clouds above Earth.',
          'zh-CN': '身披长衣的骑手与马伫立云端，俯瞰地球。'
        },
        media: media.horseman,
        href: ltxLinks.cloudRunPremium
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'ltx.pricing.banner.title',
      subtitleKey: 'ltx.pricing.banner.subtitle',
      cta: {
        labelKey: 'ltx.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  runOptions: {
    headingKey: 'ltx.runOptions.heading',
    subtitleKey: 'ltx.runOptions.subtitle',
    ctaKey: 'ltx.runOptions.cta'
  },
  reviews: {
    headingKey: 'ltx.reviews.heading',
    highlight: {
      titleKey: 'ltx.reviews.highlightTitle',
      descriptionKey: 'ltx.reviews.highlightDescription',
      ctaKey: 'ltx.reviews.highlightCta'
    }
  }
}
