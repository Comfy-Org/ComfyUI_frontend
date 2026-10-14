import type { ModelLaunchPage } from '@/templates/model-launch/types'

import { qwenImage21Page } from './qwenImage21'

export const flux3ImagePage: ModelLaunchPage = {
  ...qwenImage21Page,
  metaTitleKey: 'flux3Image.meta.title',
  metaDescriptionKey: 'flux3Image.hero.description',
  breadcrumbLabelKey: 'flux3Image.hero.title',
  breadcrumbUpdatedKey: 'flux3Image.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    placeholderLabelKey: 'flux3Image.hero.placeholder',
    titleKey: 'flux3Image.hero.title',
    descriptionKey: 'flux3Image.hero.description',
    badgeKeys: [
      'flux3Image.hero.openSource',
      'flux3Image.hero.imageGeneration',
      'flux3Image.hero.promptEnhancement'
    ],
    primaryCta: {
      labelKey: 'flux3Image.hero.primaryCta',
      href: '#launch-links'
    },
    secondaryCta: {
      labelKey: 'flux3Image.hero.secondaryCta',
      href: '#launch-links'
    }
  },
  gallery: {
    ctaVariant: 'accent',
    cards: (qwenImage21Page.gallery?.cards ?? []).map((card) => ({
      ...card,
      name: {
        en: `${card.id} — temporary Qwen reference sample`,
        'zh-CN': `${card.id} — 临时 Qwen 参考示例`
      },
      tierLabel: { en: 'Sample', 'zh-CN': '示例' },
      note: { en: 'Preview asset', 'zh-CN': '预览素材' },
      href: '#launch-links'
    }))
  },
  pricing: {
    ...qwenImage21Page.pricing,
    banner: {
      titleKey: 'qwenImage21.pricing.banner.title',
      subtitleKey: 'qwenImage21.pricing.banner.subtitle',
      cta: {
        labelKey: 'qwenImage21.pricing.banner.cta',
        href: '#launch-links'
      }
    }
  },
  faq: {
    headingKey: 'qwenImage21.faq.heading',
    items: [
      {
        id: 'overview',
        question: {
          en: 'What is Flux 3 Image?',
          'zh-CN': '什么是 Flux 3 Image？'
        },
        answer: {
          en: 'Add the approved model overview and launch announcement here.',
          'zh-CN': '在此添加已批准的模型介绍和发布公告。'
        }
      },
      {
        id: 'setup',
        question: {
          en: 'How do I use Flux 3 Image in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中使用 Flux 3 Image？'
        },
        answer: {
          en: 'Add the launch workflow, supported nodes, and setup instructions here.',
          'zh-CN': '在此添加发布工作流、支持的节点及设置说明。'
        }
      },
      {
        id: 'cost',
        question: {
          en: 'How much does Flux 3 Image cost?',
          'zh-CN': 'Flux 3 Image 的费用是多少？'
        },
        answer: {
          en: 'Add confirmed model pricing and Comfy Cloud credit usage here.',
          'zh-CN': '在此添加已确认的模型定价和 Comfy Cloud 积分用量。'
        }
      },
      {
        id: 'license',
        question: {
          en: 'Can I use Flux 3 Image commercially?',
          'zh-CN': 'Flux 3 Image 可以用于商业用途吗？'
        },
        answer: {
          en: 'Add the official license and commercial usage terms here.',
          'zh-CN': '在此添加官方许可证和商业使用条款。'
        }
      },
      {
        id: 'resolution',
        question: {
          en: 'What image sizes are supported?',
          'zh-CN': '支持哪些图像尺寸？'
        },
        answer: {
          en: 'Add verified output resolutions and aspect ratios here.',
          'zh-CN': '在此添加已验证的输出分辨率和宽高比。'
        }
      },
      {
        id: 'editing',
        question: {
          en: 'Can I edit images with Flux 3 Image?',
          'zh-CN': '可以用 Flux 3 Image 编辑图像吗？'
        },
        answer: {
          en: 'Add confirmed editing capabilities and reference image support here.',
          'zh-CN': '在此添加已确认的编辑功能和参考图像支持情况。'
        }
      }
    ]
  },
  runOptions: {
    ...qwenImage21Page.runOptions,
    subtitleKey: 'flux3Image.runOptions.subtitle'
  }
}
