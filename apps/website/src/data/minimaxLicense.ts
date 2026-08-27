import type { ModelLaunchPage } from '../templates/model-launch/types'

import { minimaxLinks } from './minimax'

// The H3 launch sizzle reel and its phone still, shared with /minimax-h3 — the
// campaign art the announcement frames are cut from.
const HERO_SIZZLE_SRC =
  'https://media.comfy.org/website/minimax/hero-sizzle.mp4'
const HERO_FALLBACK_SRC =
  'https://media.comfy.org/website/minimax/hero-fallback.jpg'

// CTA hrefs in this config must be absolute (modelLaunchPages.test.ts), so the
// contact and H3 routes are spelled out rather than taken from baseRoutes.
const CONTACT_HREF = 'https://comfy.org/contact'
const MINIMAX_H3_HREF = 'https://comfy.org/minimax-h3'

// Staged ahead of the MiniMax reseller agreement being signed. On announcement
// day: point the two hero media URLs at the approved license sizzle, and
// retire the `minimaxLicense.hero.eyebrow` "Coming soon" label or reword it.
export const minimaxLicensePage: ModelLaunchPage = {
  metaTitleKey: 'minimaxLicense.meta.title',
  metaDescriptionKey: 'minimaxLicense.meta.description',
  breadcrumbLabelKey: 'minimaxLicense.breadcrumb.model',
  breadcrumbUpdatedKey: 'minimaxLicense.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    videoSrc: HERO_SIZZLE_SRC,
    mobileFallbackImageSrc: HERO_FALLBACK_SRC,
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
      'minimaxLicense.hero.tagAudioMusic'
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
          en: 'Anyone running H3 locally for commercial work: business use, client work, or products you ship. Open weights let anyone download H3 and start creating; the license covers commercial use of what you make with it locally.',
          'zh-CN':
            '任何在本地运行 H3 进行商业创作的人：商业用途、客户项目，或你要发布的产品。开源权重让任何人都能下载 H3 开始创作；许可涵盖的，是你在本地用它创作出的内容的商业使用。'
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
          en: 'Professional and Enterprise. Enterprise customers get access to every H3 model version, including undistilled weights and new releases as they ship. Request a license and we will help you pick.',
          'zh-CN':
            '专业版和企业版。企业版客户可使用 H3 的所有模型版本，包括未蒸馏权重，以及后续发布的新版本。申请许可，我们会帮你选择。'
        }
      },
      {
        id: 'audio-music',
        question: {
          en: "Does the license cover MiniMax's audio and music models?",
          'zh-CN': '许可涵盖 MiniMax 的音频和音乐模型吗？'
        },
        answer: {
          en: "Yes. H3 commercial licenses through Comfy cover MiniMax's audio and music models too, so video, audio, and music sit under one agreement. MiniMax Music 3 is the exception: it ships under Apache 2.0 and is already free for commercial use.",
          'zh-CN':
            '涵盖。通过 Comfy 获取的 H3 商业许可同样适用于 MiniMax 的音频和音乐模型，视频、音频与音乐都在同一份协议之下。MiniMax Music 3 是例外：它采用 Apache 2.0 许可，本就可以免费商用。'
        }
      },
      {
        id: 'future-models',
        question: {
          en: 'What about future MiniMax models?',
          'zh-CN': '未来的 MiniMax 模型怎么办？'
        },
        answer: {
          en: 'If MiniMax ships a successor model as open weights, it rolls into your license automatically at no extra charge, so existing customers are covered on day one. Closed-weight releases are not covered.',
          'zh-CN':
            '如果 MiniMax 以开源权重发布后继模型，它会自动纳入你的许可，无需额外付费，现有客户从发布首日即被覆盖。闭源权重的版本不在许可范围内。'
        }
      },
      {
        id: 'not-covered',
        question: {
          en: 'What is not covered?',
          'zh-CN': '哪些情况不在许可范围内？'
        },
        answer: {
          en: 'Licenses are for building your own products and content. They do not cover running an inference platform or marketplace that sells H3 access to others.',
          'zh-CN':
            '许可用于构建你自己的产品和内容，不涵盖运营向他人出售 H3 访问权限的推理平台或交易市场。'
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
