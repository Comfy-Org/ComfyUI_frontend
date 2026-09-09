import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// ChatGPT Images 2.5 (OpenAI, announced 2026-09-08) has not shipped on Comfy
// yet, so this duplicates the flux-3 launch page section-for-section (hero,
// gallery, pricing, FAQ, closing CTA, run options, reviews) with the hero and
// closing CTA swapped for coming-soon-appropriate ones: an 'overlay' hero
// with an eyebrow badge and a placeholder still standing in for real footage
// (per ModelLaunchHero's documented announcement-page pattern), and "get
// notified" CTAs instead of a live run link. Swap in the real hero video, a
// live run CTA, and real gallery stills once the model is wired up to a
// partner node.
const chatgptImage25Links = {
  contact: 'https://comfy.org/contact',
  models: 'https://comfy.org/p/supported-models'
} as const

// No real production stills exist yet (the Air board Robert shared is not
// reachable from here), so the hero and gallery render a plain local
// placeholder panel rather than a fabricated media.comfy.org path. Swap this
// for real stills once they land from that board. Because these are local
// (not media.comfy.org) paths, this page is intentionally NOT registered in
// modelLaunchPages.test.ts — that suite's media-url checks require every
// gallery card to point at the CDN, which would force a fabricated path here.
const CHATGPT_IMAGE_25_PLACEHOLDER_SRC =
  '/images/models/chatgpt-image-2-5-placeholder.png'

const placeholderMedia: ModelLaunchMedia = {
  kind: 'image',
  src: CHATGPT_IMAGE_25_PLACEHOLDER_SRC
}

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
  // Feature claims are OpenAI's own, from its 2026-09-08 launch announcement
  // (https://openai.com/index/introducing-chatgpt-images-2-5/), cited so
  // nothing here reads as an independent benchmark. The image on every card
  // is the same local placeholder still, not a real generated example.
  gallery: {
    headingKey: 'chatgptImage25.gallery.heading',
    cards: [
      {
        id: 'text-to-image',
        name: { en: 'ChatGPT Images 2.5', 'zh-CN': 'ChatGPT Images 2.5' },
        tier: 'premium',
        note: { en: 'Coming soon', 'zh-CN': '即将推出' },
        description: {
          en: 'Sharper detail and richer texture from a single prompt, per OpenAI.',
          'zh-CN':
            '据 OpenAI 介绍，仅需一句提示词即可获得更清晰的细节与更丰富的质感。'
        },
        media: placeholderMedia,
        href: externalLinks.workflows
      },
      {
        id: 'multi-turn-editing',
        name: { en: 'ChatGPT Images 2.5', 'zh-CN': 'ChatGPT Images 2.5' },
        tier: 'premium',
        note: { en: 'Coming soon', 'zh-CN': '即将推出' },
        description: {
          en: 'Layer edits across turns while the model holds your reference subject steady.',
          'zh-CN': '在多轮编辑中持续叠加改动，模型会稳定保持你的参考主体。'
        },
        media: placeholderMedia,
        href: externalLinks.workflows
      },
      {
        id: 'sketch-to-image',
        name: { en: 'ChatGPT Images 2.5', 'zh-CN': 'ChatGPT Images 2.5' },
        tier: 'premium',
        note: { en: 'Coming soon', 'zh-CN': '即将推出' },
        description: {
          en: 'Sketch a rough layout and render it out — a new input mode OpenAI added at launch.',
          'zh-CN':
            '画一个粗略的构图草稿即可渲染成图 — OpenAI 发布时新增的输入方式。'
        },
        media: placeholderMedia,
        href: externalLinks.workflows
      },
      {
        id: 'faster-iteration',
        name: { en: 'ChatGPT Images 2.5', 'zh-CN': 'ChatGPT Images 2.5' },
        tier: 'premium',
        note: { en: 'Coming soon', 'zh-CN': '即将推出' },
        description: {
          en: 'Up to 50% lower generation latency than Images 2.0, so you iterate quicker.',
          'zh-CN': '生成延迟比 Images 2.0 最多降低 50%，迭代更快。'
        },
        media: placeholderMedia,
        href: externalLinks.workflows
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'chatgptImage25.pricing.banner.title',
      subtitleKey: 'chatgptImage25.pricing.banner.subtitle',
      cta: {
        labelKey: 'chatgptImage25.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
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
          en: `We're wiring up partner-node support now. This page swaps in a live run button and real gallery stills the moment it ships — [contact us](${chatgptImage25Links.contact}) to get notified.`,
          'zh-CN': `我们正在接入合作伙伴节点支持。上线后，本页面会立即替换为可用的运行按钮与真实图库素材 — [联系我们](${chatgptImage25Links.contact})以获取上线通知。`
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
  closingCta: {
    headingKey: 'chatgptImage25.cta.heading',
    primaryCta: {
      labelKey: 'chatgptImage25.hero.primaryCta',
      href: chatgptImage25Links.contact
    },
    secondaryCta: {
      labelKey: 'chatgptImage25.hero.secondaryCta',
      href: chatgptImage25Links.models
    }
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
