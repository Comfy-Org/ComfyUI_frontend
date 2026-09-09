import type { ModelLaunchPage } from '../templates/model-launch/types'

// ChatGPT Images 2.5 (OpenAI, announced 2026-09-08) has not shipped on Comfy
// yet, so this is an announcement page rather than a full launch page: an
// 'overlay' hero with an eyebrow badge and a placeholder still in place of
// real footage, and gallery/pricing/faq/closingCta trimmed down per the
// pattern documented on ModelLaunchHero. Swap in the full config (real
// media.comfy.org assets, a live run CTA, a gallery) once the model is wired
// up to a partner node.
const chatgptImage25Links = {
  contact: 'https://comfy.org/contact',
  models: 'https://comfy.org/p/supported-models'
} as const

// No real production stills exist yet (the Air board Robert shared is not
// reachable from here), so the hero renders a plain placeholder panel rather
// than a fabricated media.comfy.org path. Swap this for a real still once one
// lands from that board.
const CHATGPT_IMAGE_25_PLACEHOLDER_SRC =
  '/images/models/chatgpt-image-2-5-placeholder.png'

export const chatgptImage25Page: ModelLaunchPage = {
  metaTitleKey: 'chatgptImage25.meta.title',
  metaDescriptionKey: 'chatgptImage25.meta.description',
  breadcrumbLabelKey: 'chatgptImage25.breadcrumb.model',
  breadcrumbUpdatedKey: 'chatgptImage25.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    placeholderImageSrc: CHATGPT_IMAGE_25_PLACEHOLDER_SRC,
    logoSrc: '/icons/ai-models/openai.svg',
    eyebrowKey: 'nav.badgeComingSoon',
    titleKey: 'chatgptImage25.hero.title',
    descriptionKey: 'chatgptImage25.hero.description',
    badgeKeys: [
      'chatgptImage25.hero.tagTextToImage',
      'chatgptImage25.hero.tagImageEditing'
    ],
    primaryCta: {
      labelKey: 'chatgptImage25.hero.primaryCta',
      href: chatgptImage25Links.contact
    },
    secondaryCta: {
      labelKey: 'chatgptImage25.hero.secondaryCta',
      href: chatgptImage25Links.models
    }
  },
  sectionOrder: ['comparison', 'faq'],
  // Benchmarks: the latency figure is OpenAI's own launch-day claim (cited in
  // the row), not an independent measurement. Neither Artificial Analysis nor
  // LMArena had scored ChatGPT Images 2.5 as of 2026-09-09, so that row is an
  // honest TBD rather than an invented number. Source:
  // https://openai.com/index/introducing-chatgpt-images-2-5/
  comparison: {
    headingKey: 'chatgptImage25.comparison.heading',
    columns: [
      {
        id: 'images-2-0',
        label: { en: 'ChatGPT Images 2.0', 'zh-CN': 'ChatGPT Images 2.0' }
      },
      {
        id: 'images-2-5',
        label: { en: 'ChatGPT Images 2.5', 'zh-CN': 'ChatGPT Images 2.5' }
      }
    ],
    rows: [
      {
        id: 'latency',
        label: {
          en: 'Generation latency',
          'zh-CN': '生成延迟'
        },
        cells: [
          { en: 'Baseline', 'zh-CN': '基准水平' },
          {
            en: 'Up to 50% faster (OpenAI, Sept 2026)',
            'zh-CN': '最多快 50%（OpenAI，2026 年 9 月）'
          }
        ]
      },
      {
        id: 'editing',
        label: {
          en: 'Multi-turn edit consistency',
          'zh-CN': '多轮编辑一致性'
        },
        cells: [
          { en: 'Good', 'zh-CN': '良好' },
          {
            en: 'Improved subject preservation (OpenAI)',
            'zh-CN': '主体保持能力更强（OpenAI 说法）'
          }
        ]
      },
      {
        id: 'independent-benchmark',
        label: {
          en: 'Independent arena Elo',
          'zh-CN': '第三方竞技场 Elo 评分'
        },
        cells: [
          {
            en: '1178 (Artificial Analysis, Jul 2026)',
            'zh-CN': '1178（Artificial Analysis，2026 年 7 月）'
          },
          {
            en: 'TBD — not yet independently benchmarked',
            'zh-CN': '待定 — 尚无第三方评测数据'
          }
        ]
      }
    ]
  },
  faq: {
    headingKey: 'chatgptImage25.faq.heading',
    items: [
      {
        id: 'what-is-it',
        question: {
          en: 'What is ChatGPT Images 2.5?',
          'zh-CN': 'ChatGPT Images 2.5 是什么？'
        },
        answer: {
          en: `OpenAI's newest image model, announced [September 8, 2026](https://openai.com/index/introducing-chatgpt-images-2-5/). OpenAI says it sharpens detail, holds reference subjects steadier across edits, and cuts generation latency by up to 50% versus ChatGPT Images 2.0.`,
          'zh-CN':
            'OpenAI 于 [2026 年 9 月 8 日](https://openai.com/index/introducing-chatgpt-images-2-5/)发布的最新图像模型。OpenAI 表示它能生成更清晰的细节、在多轮编辑中更好地保持参考主体，并将生成延迟比 ChatGPT Images 2.0 降低多达 50%。'
        }
      },
      {
        id: 'when-on-comfy',
        question: {
          en: 'When can I run it on Comfy?',
          'zh-CN': '什么时候能在 Comfy 上使用？'
        },
        answer: {
          en: `We're wiring up partner-node support now. This page swaps in a live run button the moment it ships — [contact us](${chatgptImage25Links.contact}) to get notified.`,
          'zh-CN': `我们正在接入合作伙伴节点支持。上线后，本页面会立即替换为可用的运行按钮 — [联系我们](${chatgptImage25Links.contact})以获取上线通知。`
        }
      },
      {
        id: 'independent-benchmarks',
        question: {
          en: 'Are these numbers from an independent benchmark?',
          'zh-CN': '这些数据来自第三方评测吗？'
        },
        answer: {
          en: "No — the latency figure above is OpenAI's own launch claim, not a third-party measurement. As of September 9, 2026, neither Artificial Analysis nor LMArena had published a score for ChatGPT Images 2.5; we'll update this page once independent results are out.",
          'zh-CN':
            '不是 — 上面的延迟数据是 OpenAI 自己在发布时给出的说法，并非第三方测量结果。截至 2026 年 9 月 9 日，Artificial Analysis 和 LMArena 均尚未公布 ChatGPT Images 2.5 的评分；待第三方结果公布后我们会更新此页面。'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'chatgptImage25.runOptions.heading',
    subtitleKey: 'chatgptImage25.runOptions.subtitle',
    ctaKey: 'chatgptImage25.runOptions.cta'
  },
  reviews: {
    headingKey: 'chatgptImage25.reviews.heading',
    highlight: {
      titleKey: 'chatgptImage25.reviews.highlightTitle',
      descriptionKey: 'chatgptImage25.reviews.highlightDescription',
      ctaKey: 'chatgptImage25.reviews.highlightCta'
    }
  }
}
