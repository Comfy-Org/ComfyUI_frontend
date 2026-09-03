import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Comfy Cloud nodes are a feature launch rather than a model launch, but the
// shape is the same: one hero, how it works, pricing, FAQ. Reusing the template
// means no new components and the same locale coverage the model pages get.
//
// PLACEHOLDER MEDIA: the hero still is an existing site asset. Replace it with
// a capture of a Comfy Cloud node on canvas before this ships.
const HERO_STILL = '/hero/input.webp'

// Where every CTA lands. Local users need a Comfy account to spend credits, and
// the node itself is discovered in the node library once ComfyUI ships it.
const GET_STARTED = externalLinks.cloud

export const cloudNodesPage: ModelLaunchPage = {
  metaTitleKey: 'cloudNodes.meta.title',
  metaDescriptionKey: 'cloudNodes.meta.description',
  breadcrumbLabelKey: 'cloudNodes.breadcrumb.model',
  breadcrumbUpdatedKey: 'cloudNodes.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    placeholderImageSrc: HERO_STILL,
    badgeKeys: [
      'cloudNodes.hero.tagNoSubscription',
      'cloudNodes.hero.tagOpenModels',
      'cloudNodes.hero.tagPayPerRun'
    ],
    titleKey: 'cloudNodes.hero.title',
    titleRestKey: 'cloudNodes.hero.titleRest',
    descriptionKey: 'cloudNodes.hero.description',
    primaryCta: {
      labelKey: 'cloudNodes.hero.primaryCta',
      href: GET_STARTED,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'cloudNodes.hero.secondaryCta',
      href: externalLinks.cloud,
      target: '_blank'
    }
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'cloudNodes.pricing.banner.title',
      subtitleKey: 'cloudNodes.pricing.banner.subtitle',
      cta: {
        labelKey: 'cloudNodes.pricing.banner.cta',
        href: GET_STARTED,
        target: '_blank'
      }
    }
  },
  steps: {
    headingKey: 'cloudNodes.steps.heading',
    stepLabelKey: 'cloudNodes.steps.step',
    items: [
      {
        id: 'update-comfyui',
        title: { en: 'Update ComfyUI', 'zh-CN': '更新 ComfyUI' },
        description: {
          en: 'The Comfy Cloud nodes arrive with the release, alongside every other partner node.',
          'zh-CN': '随版本更新一同提供，与其他合作伙伴节点一样。'
        }
      },
      {
        id: 'drop-in-a-node',
        title: { en: 'Drop one into your graph', 'zh-CN': '拖入你的工作流' },
        description: {
          en: 'Search the node library for Comfy Cloud. Wire it up like any other node.',
          'zh-CN': '在节点库中搜索 Comfy Cloud，像其他节点一样连线即可。'
        }
      },
      {
        id: 'run-it',
        title: { en: 'Run it', 'zh-CN': '运行' },
        description: {
          en: 'The model runs on our GPUs. You are charged per GPU-second, with no plan required.',
          'zh-CN': '模型在我们的 GPU 上运行，按 GPU 秒数计费，无需订阅套餐。'
        }
      }
    ],
    primaryCta: {
      labelKey: 'cloudNodes.steps.primaryCta',
      href: GET_STARTED,
      target: '_blank'
    }
  },
  faq: {
    headingKey: 'cloudNodes.faq.heading',
    items: [
      {
        id: 'subscription',
        question: {
          en: 'Do I need a Comfy Cloud subscription?',
          'zh-CN': '我需要订阅 Comfy Cloud 吗？'
        },
        answer: {
          en: 'No. These behave like every other partner node: an account and credits are enough. There is no plan floor.',
          'zh-CN':
            '不需要。它们与其他合作伙伴节点一样，只需账号和积分即可使用，没有套餐门槛。'
        }
      },
      {
        id: 'what-runs',
        question: {
          en: 'What actually runs on your side?',
          'zh-CN': '究竟有哪些内容在你们那边运行？'
        },
        answer: {
          en: 'A curated workflow per node, pinned to an exact model version so a saved graph keeps producing the same thing. Your graph, prompts and inputs stay on your machine apart from what the node sends.',
          'zh-CN':
            '每个节点对应一套精选工作流，并锁定具体模型版本，因此保存的工作流会持续产出一致的结果。除节点发送的内容外，你的工作流、提示词与输入都保留在本机。'
        }
      },
      {
        id: 'cost',
        question: { en: 'How is it billed?', 'zh-CN': '如何计费？' },
        answer: {
          en: 'Per GPU-second in credits, shown on the node before you run. A short image generation is a few seconds; video is longer.',
          'zh-CN':
            '按 GPU 秒数以积分计费，运行前会在节点上显示。生成一张图通常只需几秒，视频则更久。'
        }
      },
      {
        id: 'own-models',
        question: {
          en: 'Can I use my own LoRAs or checkpoints?',
          'zh-CN': '可以使用我自己的 LoRA 或模型吗？'
        },
        answer: {
          en: 'Not yet. Each node exposes a fixed set of weights we host. Bringing your own is the obvious next step and is not in this first release.',
          'zh-CN':
            '暂时还不行。每个节点仅提供我们托管的固定权重集合。自带模型是后续的明确方向，但不在首个版本中。'
        }
      },
      {
        id: 'still-local',
        question: {
          en: 'Does this replace running locally?',
          'zh-CN': '这会取代本地运行吗？'
        },
        answer: {
          en: 'No, and it should not. Keep running what your machine handles well. These nodes exist for the models it cannot, without asking you to leave your workflow.',
          'zh-CN':
            '不会，也不应该。本机跑得动的继续在本机跑。这些节点是为跑不动的模型准备的，同时让你无需离开自己的工作流。'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'cloudNodes.runOptions.heading',
    subtitleKey: 'cloudNodes.runOptions.subtitle',
    ctaKey: 'cloudNodes.runOptions.cta'
  },
  reviews: {
    headingKey: 'cloudNodes.reviews.heading',
    highlight: {
      titleKey: 'cloudNodes.reviews.highlightTitle',
      descriptionKey: 'cloudNodes.reviews.highlightDescription',
      ctaKey: 'cloudNodes.reviews.highlightCta'
    }
  }
}
