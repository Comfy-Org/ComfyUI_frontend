import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'
import { qwenImage21Page } from './qwenImage21'

export const geminiNanoBanana25Page: ModelLaunchPage = {
  metaTitleKey: 'geminiNanoBanana25.meta.title',
  metaDescriptionKey: 'geminiNanoBanana25.meta.description',
  breadcrumbLabelKey: 'geminiNanoBanana25.breadcrumb.model',
  breadcrumbUpdatedKey: 'geminiNanoBanana25.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    logoSrc: '/icons/ai-models/gemini.svg',
    videoSrc: qwenImage21Page.hero.videoSrc,
    posterSrc: qwenImage21Page.hero.posterSrc,
    mobileFallbackImageSrc: qwenImage21Page.hero.mobileFallbackImageSrc,
    mobileVideoSrc: qwenImage21Page.hero.mobileVideoSrc,
    titleKey: 'geminiNanoBanana25.hero.title',
    descriptionKey: 'geminiNanoBanana25.hero.description',
    badgeKeys: ['geminiNanoBanana25.hero.badge'],
    primaryCta: {
      labelKey: 'geminiNanoBanana25.hero.primaryCta',
      href: externalLinks.cloudCta('gemini_nano_banana_2_5_draft'),
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'geminiNanoBanana25.hero.secondaryCta',
      href: 'https://docs.comfy.org/',
      target: '_blank'
    }
  },
  gallery: {
    headingKey: 'geminiNanoBanana25.gallery.heading',
    ctaVariant: 'accent',
    cards: (qwenImage21Page.gallery?.cards ?? []).map((card) => ({
      ...card,
      note: { en: 'Qwen placeholder', 'zh-CN': 'Qwen 占位素材' },
      href: externalLinks.cloudCta('gemini_nano_banana_2_5_draft')
    }))
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'geminiNanoBanana25.pricing.banner.title',
      subtitleKey: 'geminiNanoBanana25.pricing.banner.subtitle',
      cta: {
        labelKey: 'geminiNanoBanana25.pricing.banner.cta',
        href: externalLinks.pricing,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'geminiNanoBanana25.faq.heading',
    items: [
      {
        id: 'about',
        question: {
          en: 'What is Gemini Nano Banana 2.5?',
          'zh-CN': 'Gemini Nano Banana 2.5 是什么？'
        },
        answer: {
          en: 'Model introduction and confirmed capabilities will be added here. This page is a draft layout for review.',
          'zh-CN':
            '模型介绍与已确认的功能将在此补充。本页面为供审阅的布局草稿。'
        }
      },
      {
        id: 'availability',
        question: {
          en: 'How will I use Gemini Nano Banana 2.5 in Comfy?',
          'zh-CN': '如何在 Comfy 中使用 Gemini Nano Banana 2.5？'
        },
        answer: {
          en: 'Availability, workflow links, and setup instructions are pending confirmation.',
          'zh-CN': '可用性、工作流链接与设置说明待确认。'
        }
      },
      {
        id: 'pricing',
        question: {
          en: 'How much will Gemini Nano Banana 2.5 cost?',
          'zh-CN': 'Gemini Nano Banana 2.5 的费用是多少？'
        },
        answer: {
          en: 'Model pricing is pending confirmation. The plans above are general Comfy Cloud plans.',
          'zh-CN': '模型价格待确认。上方展示的是通用 Comfy Cloud 套餐。'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'geminiNanoBanana25.runOptions.heading',
    subtitleKey: 'geminiNanoBanana25.runOptions.subtitle',
    ctaKey: 'qwenImage21.runOptions.cta'
  },
  reviews: qwenImage21Page.reviews
}
