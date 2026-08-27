import type { ModelLaunchPage } from '../templates/model-launch/types'

import { minimaxLinks } from './minimax'

// The frosted backdrop every announcement page shares — keeps the hero text
// readable and matches the blog hero treatment.
const COMING_SOON_HERO = 'https://media.comfy.org/website/coming-soon/hero.webp'

// CTA hrefs in this config must be absolute (modelLaunchPages.test.ts), so the
// contact and H3 routes are spelled out rather than taken from baseRoutes.
const CONTACT_HREF = 'https://comfy.org/contact'
const MINIMAX_H3_HREF = 'https://comfy.org/minimax-h3'

// Staged ahead of the MiniMax reseller agreement being signed. If an approved
// short sizzle lands, set hero.videoSrc (+ mobileFallbackImageSrc for phones)
// and the overlay plays it behind the scrim in place of the backdrop. On
// announcement day, retire the `minimaxLicense.hero.eyebrow` "Coming soon"
// label or reword it.
export const minimaxLicensePage: ModelLaunchPage = {
  metaTitleKey: 'minimaxLicense.meta.title',
  metaDescriptionKey: 'minimaxLicense.meta.description',
  breadcrumbLabelKey: 'minimaxLicense.breadcrumb.model',
  breadcrumbUpdatedKey: 'minimaxLicense.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    placeholderImageSrc: COMING_SOON_HERO,
    eyebrowKey: 'minimaxLicense.hero.eyebrow',
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
  sectionOrder: ['steps', 'faq', 'closingCta'],
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
        id: 'try-on-cloud',
        title: {
          en: 'Try H3 on Comfy Cloud',
          'zh-CN': '在 Comfy Cloud 上试用 H3'
        },
        description: {
          en: 'Run the H3 workflows in the template library. Commercial rights are already included on Cloud.',
          'zh-CN': '运行模板库中的 H3 工作流。Cloud 上已包含商业权利。'
        }
      },
      {
        id: 'request-a-license',
        title: {
          en: "Tell us what you're building",
          'zh-CN': '告诉我们你在构建什么'
        },
        description: {
          en: 'Request a license and we will help you pick Professional or Enterprise.',
          'zh-CN': '申请许可，我们会帮你在专业版与企业版之间选择。'
        }
      },
      {
        id: 'run-locally',
        title: {
          en: 'Run H3 on your own hardware',
          'zh-CN': '在自有硬件上运行 H3'
        },
        description: {
          en: 'Full commercial rights to your outputs, fine-tuning and LoRA training included.',
          'zh-CN': '产出的完整商业权利归你，包含微调与 LoRA 训练。'
        }
      }
    ]
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
          en: 'What plans are available?',
          'zh-CN': '有哪些方案可选？'
        },
        answer: {
          en: 'Professional and Enterprise. Professional is a fixed-price license for studios shipping client work. Enterprise adds volume pricing, unlimited seats, and access to undistilled weights that Professional does not get. Request a license and we will help you pick.',
          'zh-CN':
            '专业版和企业版。专业版是面向交付客户项目的工作室的固定价格许可。企业版增加批量定价、不限席位，以及专业版没有的未蒸馏权重使用权。申请许可，我们会帮你选择。'
        }
      },
      {
        id: 'audio-music',
        question: {
          en: "Does the license cover MiniMax's audio and music models?",
          'zh-CN': '许可涵盖 MiniMax 的音频和音乐模型吗？'
        },
        answer: {
          en: 'Yes. MiniMax commercial licenses through Comfy cover MiniMax H3 and MiniMax Audio & Music, available globally, so video, audio, and music sit under one agreement. MiniMax Music 3 is the exception: it ships under Apache 2.0 and is already free for commercial use.',
          'zh-CN':
            '涵盖。通过 Comfy 获取的 MiniMax 商业许可涵盖 MiniMax H3 以及 MiniMax 音频与音乐模型，全球可用，视频、音频与音乐都在同一份协议之下。MiniMax Music 3 是例外：它采用 Apache 2.0 许可，本就可以免费商用。'
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
