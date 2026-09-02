import type {
  ModelLaunchComparison,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { minimaxLinks } from './minimax'

// The license-page hero loop and its phone still (dark H3 renders), served from
// media.comfy.org. Phones render the still and never fetch the video, same as
// /minimax-h3.
const HERO_VIDEO_SRC =
  'https://media.comfy.org/website/minimax-license/hero.mp4'
const HERO_POSTER_SRC =
  'https://media.comfy.org/website/minimax-license/hero-poster.jpg'

// CTA hrefs in this config must be absolute (modelLaunchPages.test.ts), so the
// contact and H3 routes are spelled out rather than taken from baseRoutes.
const CONTACT_HREF = 'https://comfy.org/contact'
const MINIMAX_H3_HREF = 'https://comfy.org/minimax-h3'

// Rows and figures come from the tier table supplied for this page
// (2026-09-02); the pricing numbers live only here, so a deal change means
// editing this table. /pricing renders these same rows in its resource-costs
// band (MinimaxLicenseCostBand), which is why it is a named export.
export const minimaxLicenseComparison: ModelLaunchComparison = {
  headingKey: 'minimaxLicense.comparison.heading',
  columns: [
    { id: 'professional', label: { en: 'Professional', 'zh-CN': '专业版' } },
    { id: 'enterprise', label: { en: 'Enterprise', 'zh-CN': '企业版' } }
  ],
  rows: [
    {
      id: 'price',
      label: { en: 'Price', 'zh-CN': '价格' },
      cells: [
        { en: 'From $5,000 / month', 'zh-CN': '5,000 美元 / 月起' },
        { en: 'Contact sales', 'zh-CN': '联系销售' }
      ]
    },
    {
      id: 'video-seconds',
      label: { en: 'Video-seconds included', 'zh-CN': '包含视频秒数' },
      cells: [
        { en: '~46,250', 'zh-CN': '约 46,250' },
        { en: 'Custom', 'zh-CN': '定制' }
      ]
    },
    {
      id: 'price-per-video-second',
      label: {
        en: 'Price per video-second (in bundle)',
        'zh-CN': '每视频秒价格（套餐内）'
      },
      cells: [
        { en: '$0.108', 'zh-CN': '0.108 美元' },
        { en: 'Contact sales', 'zh-CN': '联系销售' }
      ]
    },
    {
      id: 'overage',
      label: {
        en: 'Overage per video-second',
        'zh-CN': '超出部分每视频秒价格'
      },
      cells: [
        { en: '$0.036', 'zh-CN': '0.036 美元' },
        { en: 'Contact sales', 'zh-CN': '联系销售' }
      ]
    },
    {
      id: 'licensed-users',
      label: { en: 'Licensed users', 'zh-CN': '授权用户' },
      cells: [
        { en: 'Up to 10', 'zh-CN': '最多 10 个' },
        { en: 'No cap', 'zh-CN': '不设上限' }
      ]
    },
    {
      id: 'domains',
      label: { en: 'Domains', 'zh-CN': '域名数量' },
      cells: [
        { en: '1', 'zh-CN': '1 个' },
        { en: 'Custom', 'zh-CN': '定制' }
      ]
    },
    {
      id: 'commercial-use',
      label: {
        en: 'Commercial use of outputs',
        'zh-CN': '产出的商业使用'
      },
      cells: [
        {
          en: 'Yes, full commercial rights',
          'zh-CN': '是，完整商业权利'
        },
        {
          en: 'Yes, full commercial rights',
          'zh-CN': '是，完整商业权利'
        }
      ]
    },
    {
      id: 'fine-tuning',
      label: {
        en: 'Fine-tuning and LoRA training',
        'zh-CN': '微调与 LoRA 训练'
      },
      cells: [
        { en: 'Yes', 'zh-CN': '是' },
        { en: 'Yes', 'zh-CN': '是' }
      ]
    },
    {
      id: 'client-work',
      label: {
        en: 'Client and downstream work',
        'zh-CN': '客户与下游项目'
      },
      cells: [
        { en: 'Yes', 'zh-CN': '是' },
        { en: 'Yes', 'zh-CN': '是' }
      ]
    },
    {
      id: 'model-versions',
      label: { en: 'Model versions', 'zh-CN': '模型版本' },
      cells: [
        {
          en: 'Distilled open-weight versions',
          'zh-CN': '蒸馏开源权重版本'
        },
        {
          en: 'Every version, undistilled weights included',
          'zh-CN': '所有版本，包括未蒸馏权重'
        }
      ]
    },
    {
      id: 'term',
      label: { en: 'Term', 'zh-CN': '期限' },
      cells: [
        { en: 'Monthly', 'zh-CN': '按月' },
        { en: '12-month minimum', 'zh-CN': '至少 12 个月' }
      ]
    }
  ]
}

export const minimaxLicensePage: ModelLaunchPage = {
  metaTitleKey: 'minimaxLicense.meta.title',
  metaDescriptionKey: 'minimaxLicense.meta.description',
  breadcrumbLabelKey: 'minimaxLicense.breadcrumb.model',
  breadcrumbUpdatedKey: 'minimaxLicense.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    videoSrc: HERO_VIDEO_SRC,
    posterSrc: HERO_POSTER_SRC,
    mobileFallbackImageSrc: HERO_POSTER_SRC,
    titleKey: 'minimaxLicense.hero.title',
    descriptionKey: 'minimaxLicense.hero.description',
    primaryCta: {
      labelKey: 'minimaxLicense.hero.primaryCta',
      href: CONTACT_HREF
    },
    secondaryCta: {
      labelKey: 'minimaxLicense.hero.secondaryCta',
      href: minimaxLinks.cloudRun,
      target: '_blank'
    },
    badgeKeys: [
      'minimaxLicense.hero.tagOfficialReseller',
      'minimaxLicense.hero.tagAudioMusic',
      'minimaxLicense.hero.tagGlobal'
    ]
  },
  sectionOrder: ['steps', 'comparison', 'faq', 'closingCta'],
  steps: {
    headingKey: 'minimaxLicense.steps.heading',
    stepLabelKey: 'minimaxLicense.steps.step',
    primaryCta: {
      labelKey: 'minimaxLicense.steps.primaryCta',
      href: CONTACT_HREF
    },
    secondaryCta: {
      labelKey: 'minimaxLicense.steps.secondaryCta',
      href: MINIMAX_H3_HREF
    },
    items: [
      {
        id: 'professional',
        title: { en: 'Professional', 'zh-CN': '专业版' },
        description: {
          en: 'A fixed-price monthly license for studios and teams shipping client work. Up to 10 licensed users, on distilled open-weight model versions.',
          'zh-CN':
            '面向交付客户项目的工作室和团队的固定价格月度许可。最多 10 个授权用户，使用蒸馏开源权重模型版本。'
        }
      },
      {
        id: 'enterprise',
        title: { en: 'Enterprise', 'zh-CN': '企业版' },
        description: {
          en: 'An annual agreement for teams building MiniMax into their product. Custom volume pricing, no user cap, and every model version, undistilled weights included.',
          'zh-CN':
            '面向将 MiniMax 构建进自家产品的团队的年度协议。定制批量定价，不限用户数，涵盖所有模型版本，包括未蒸馏权重。'
        }
      }
    ]
  },
  comparison: minimaxLicenseComparison,
  // Open-weight successor models roll into an active license per the deal, but
  // that line stays OFF the page until the contract's "qualifying" language is
  // tightened (Kevin, 08-27) — stick to what's covered today.
  faq: {
    headingKey: 'minimaxLicense.faq.heading',
    items: [
      {
        id: 'who-needs-a-license',
        question: {
          en: 'Who needs a MiniMax H3 commercial license?',
          'zh-CN': '谁需要 MiniMax H3 商业许可？'
        },
        answer: {
          en: 'Anyone running MiniMax models locally for commercial work: business use, client work, or products you ship. Open weights let anyone download the models and start creating; the license is what makes commercial use of your local outputs legal.',
          'zh-CN':
            '任何在本地运行 MiniMax 模型进行商业创作的人：商业用途、客户项目，或你要发布的产品。开源权重让任何人都能下载模型开始创作；许可让你本地产出的商业使用合法合规。'
        }
      },
      {
        id: 'whats-included',
        question: {
          en: 'What does the license include?',
          'zh-CN': '许可包含什么？'
        },
        answer: {
          en: 'Full commercial rights to your outputs: everything you generate is yours to use, sell, and ship. Fine-tuning and LoRA training on your characters, your style, or your product. Client and downstream work, so agencies and studios can use H3 for customer projects.',
          'zh-CN':
            '产出的完整商业权利：你生成的一切都归你所有，可自由使用、出售和发布。可针对你的角色、风格或产品进行微调和 LoRA 训练。涵盖客户项目与下游用途，创意代理商和工作室都可以将 H3 用于客户项目。'
        }
      },
      {
        id: 'cloud-already-covered',
        question: {
          en: "I'm on Comfy Cloud. Do I need a license?",
          'zh-CN': '我在使用 Comfy Cloud，还需要许可吗？'
        },
        answer: {
          en: 'No. Comfy Cloud subscriptions already include commercial rights to what you generate. This license is for running H3 locally on your own hardware.',
          'zh-CN':
            '不需要。Comfy Cloud 订阅已包含你所生成内容的商业权利。此许可面向在自有硬件上本地运行 H3 的场景。'
        }
      },
      {
        id: 'plans',
        question: {
          en: 'What is the difference between the Professional and Enterprise tiers?',
          'zh-CN': '专业版和企业版有什么区别？'
        },
        answer: {
          en: 'Professional is a fixed-price monthly license for studios and teams shipping client work, with up to 10 licensed users on distilled open-weight model versions. Enterprise is an annual agreement with custom volume pricing, no user cap, and every model version, undistilled weights included. Request a license and we will help you pick.',
          'zh-CN':
            '专业版是面向交付客户项目的工作室和团队的固定价格月度许可，最多 10 个授权用户，使用蒸馏开源权重模型版本。企业版是年度协议，提供定制批量定价，不限用户数，涵盖包括未蒸馏权重在内的所有模型版本。申请许可，我们会帮你选择。'
        }
      },
      {
        id: 'audio-music',
        question: {
          en: "Does the license cover MiniMax's audio and music models?",
          'zh-CN': '许可涵盖 MiniMax 的音频和音乐模型吗？'
        },
        answer: {
          en: 'Yes. MiniMax commercial licenses through Comfy cover MiniMax H3 and MiniMax Audio & Music, available globally, so video, audio, and music sit under one agreement. MiniMax Music 3 has its own Community License that allows free commercial use below 20 million US dollars in yearly revenue; above that threshold, it needs a commercial license too.',
          'zh-CN':
            '涵盖。通过 Comfy 获取的 MiniMax 商业许可涵盖 MiniMax H3 以及 MiniMax 音频与音乐模型，全球可用，视频、音频与音乐都在同一份协议之下。MiniMax Music 3 拥有自己的社区许可，年收入低于 2000 万美元的公司可免费商用；超过该门槛，同样需要商业许可。'
        }
      },
      {
        id: 'not-covered',
        question: {
          en: 'What is not covered?',
          'zh-CN': '哪些情况不在许可范围内？'
        },
        answer: {
          en: 'Reselling or sublicensing the model, and running a model marketplace, API aggregator, inference-as-a-service, or model-routing platform. The license is for building your own products and content.',
          'zh-CN':
            '转售或再许可模型，以及运营模型市场、API 聚合、推理即服务或模型路由平台。许可用于构建你自己的产品和内容。'
        }
      }
    ]
  },
  closingCta: {
    headingKey: 'minimaxLicense.cta.heading',
    primaryCta: {
      labelKey: 'minimaxLicense.cta.primaryCta',
      href: CONTACT_HREF
    }
  },
  runOptions: {
    headingKey: 'minimaxLicense.runOptions.heading',
    subtitleKey: 'minimaxLicense.runOptions.subtitle',
    ctaKey: 'minimaxLicense.runOptions.cta'
  },
  reviews: {
    headingKey: 'minimaxLicense.reviews.heading',
    highlight: {
      titleKey: 'minimaxLicense.reviews.highlightTitle',
      descriptionKey: 'minimaxLicense.reviews.highlightDescription',
      ctaKey: 'minimaxLicense.reviews.highlightCta',
      route: 'fdct'
    }
  }
}
