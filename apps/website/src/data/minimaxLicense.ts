import type { ModelLaunchPage } from '../templates/model-launch/types'

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
  sectionOrder: ['steps', 'rateCard', 'faq', 'closingCta'],
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
  // The public rate card. Professional's list price, the Enterprise annual
  // floor, and both tiers' terms are the customer-facing halves of Schedule 3;
  // per-video-second rates, bundle volumes, and overage mechanics stay in
  // sales conversations.
  rateCard: {
    headingKey: 'minimaxLicense.rateCard.heading',
    subtitleKey: 'minimaxLicense.rateCard.subtitle',
    columns: [
      {
        id: 'professional',
        name: { en: 'Professional', 'zh-CN': '专业版' },
        price: { en: 'From $5,000', 'zh-CN': '$5,000 起' },
        priceNote: { en: 'per month', 'zh-CN': '每月' }
      },
      {
        id: 'enterprise',
        name: { en: 'Enterprise', 'zh-CN': '企业版' },
        price: { en: 'Custom', 'zh-CN': '定制' },
        priceNote: {
          en: 'annual agreement, priced to your volume',
          'zh-CN': '年度协议，按用量定价'
        }
      }
    ],
    rows: [
      {
        id: 'fit',
        label: { en: 'Built for', 'zh-CN': '适合' },
        values: [
          {
            en: 'Studios and teams running H3 on their own hardware, up to 10 people',
            'zh-CN': '在自有硬件上运行 H3 的工作室与团队，最多 10 人'
          },
          {
            en: 'Larger teams, higher volume, undistilled weights, or H3 inside your own product',
            'zh-CN': '更大团队、更高用量、未蒸馏权重，或将 H3 集成进自有产品'
          }
        ]
      },
      {
        id: 'term',
        label: { en: 'Term', 'zh-CN': '期限' },
        values: [
          { en: 'Monthly', 'zh-CN': '按月' },
          { en: '12-month minimum', 'zh-CN': '12 个月起' }
        ]
      },
      {
        id: 'users',
        label: { en: 'Licensed users', 'zh-CN': '授权用户' },
        values: [
          { en: 'Up to 10', 'zh-CN': '最多 10 个' },
          { en: 'No cap', 'zh-CN': '不设上限' }
        ]
      },
      {
        id: 'domains',
        label: { en: 'Domains', 'zh-CN': '域名' },
        values: [
          { en: '1', 'zh-CN': '1 个' },
          { en: 'Custom', 'zh-CN': '定制' }
        ]
      },
      {
        id: 'versions',
        label: { en: 'Model versions', 'zh-CN': '模型版本' },
        values: [
          { en: 'Distilled open weights', 'zh-CN': '蒸馏开源权重' },
          {
            en: 'All versions, undistilled weights and new releases included',
            'zh-CN': '所有版本，含未蒸馏权重与新发布'
          }
        ]
      },
      {
        id: 'commercial-use',
        label: { en: 'Commercial use of outputs', 'zh-CN': '产出的商业使用' },
        values: [
          { en: 'Full commercial rights', 'zh-CN': '完整商业权利' },
          { en: 'Full commercial rights', 'zh-CN': '完整商业权利' }
        ]
      },
      {
        id: 'fine-tuning',
        label: { en: 'Fine-tuning and LoRA', 'zh-CN': '微调与 LoRA' },
        values: [
          { en: 'Included', 'zh-CN': '包含' },
          { en: 'Included', 'zh-CN': '包含' }
        ]
      },
      {
        id: 'client-work',
        label: { en: 'Client and downstream work', 'zh-CN': '客户与下游项目' },
        values: [
          { en: 'Included', 'zh-CN': '包含' },
          { en: 'Included', 'zh-CN': '包含' }
        ]
      }
    ],
    footnote: {
      en: 'You need a license when you run H3 on your own hardware in the US, EU, UK, or Korea, or your company makes over 20 million US dollars a year. Comfy Cloud already includes commercial rights, and outside those territories the free MiniMax community license covers commercial use under that revenue line. Enterprise is quoted to your generation volume and team.',
      'zh-CN':
        '当你在美国、欧盟、英国或韩国的自有硬件上运行 H3，或公司年收入超过 2,000 万美元时，需要此许可。Comfy Cloud 已包含商业权利；在上述地区之外且年收入低于该线时，MiniMax 免费的社区许可即可覆盖商业使用。企业版按生成量与团队规模报价。'
    },
    primaryCta: {
      labelKey: 'minimaxLicense.steps.primaryCta',
      href: CONTACT_HREF
    }
  },
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
          en: 'Teams running H3 on their own hardware in the US, EU, UK, or Korea, or with more than 20 million US dollars in yearly revenue, for business use, client work, or products they ship. Comfy Cloud generations already include commercial rights. Outside those four territories and under that revenue line, the free MiniMax community license covers local commercial use with a Powered by MiniMax H3 credit, and the same territory rule applies to where your outputs are used.',
          'zh-CN':
            '在美国、欧盟、英国或韩国的自有硬件上运行 H3，或年收入超过 2,000 万美元的团队，用于商业用途、客户项目或对外发布的产品。Comfy Cloud 的生成已包含商业权利。在这四个地区之外且年收入低于该线时，MiniMax 免费的社区许可即可覆盖本地商业使用（需标注 Powered by MiniMax H3），且同样的地区规则也适用于产出的使用地。'
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
        id: 'pricing',
        question: {
          en: 'How much does a commercial license cost?',
          'zh-CN': '商业许可多少钱？'
        },
        answer: {
          en: 'Professional starts at $5,000 a month on a monthly term, with up to 10 licensed users on distilled open-weight model versions. Enterprise is an annual agreement priced to your generation volume, with no user cap and every model version, undistilled weights included; there is no flat list price because it is sized per team. Request a license and we will quote it.',
          'zh-CN':
            '专业版每月 5,000 美元起，按月订阅，最多 10 个授权用户，使用蒸馏开源权重模型版本。企业版为年度协议，按生成量定价，不限用户数，涵盖包括未蒸馏权重在内的所有模型版本；因按团队定制，不设固定标价。申请许可，我们会为你报价。'
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
