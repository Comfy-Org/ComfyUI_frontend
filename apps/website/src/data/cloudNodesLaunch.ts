import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// A feature launch rather than a model launch, but the page shape is the same,
// so the model-launch template covers it with no new components.
//
// The 15s launch film. Its poster is cut from the node-graph beat rather than
// frame 0, which is a near-black orbit shot. media.comfy.org objects are cached
// for an hour, so bump the `_v1` suffix rather than re-uploading a key.
const media = {
  hero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/cloud-nodes/hero_v1.mp4',
    posterSrc: 'https://media.comfy.org/website/cloud-nodes/hero-poster_v1.webp'
  }
} as const satisfies Record<string, ModelLaunchMedia>

// Where every CTA lands. Local users need a Comfy account to spend credits, and
// the node itself is discovered in the node library once ComfyUI ships it.
const GET_STARTED = externalLinks.cloud

export const cloudNodesPage: ModelLaunchPage = {
  metaTitleKey: 'cloudNodesLaunch.meta.title',
  metaDescriptionKey: 'cloudNodesLaunch.meta.description',
  breadcrumbLabelKey: 'cloudNodesLaunch.breadcrumb.model',
  breadcrumbUpdatedKey: 'cloudNodesLaunch.breadcrumb.updated',
  hero: {
    // The film has burnt-in title cards, so 'overlay' would double up the copy.
    layout: 'media-first',
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    // Phones get the poster rather than a 2.8MB download they cannot hear.
    mobileFallbackImageSrc: media.hero.posterSrc,
    badgeKeys: [
      'cloudNodesLaunch.hero.tagBeta',
      'cloudNodesLaunch.hero.tagNoSubscription',
      'cloudNodesLaunch.hero.tagOpenModels',
      'cloudNodesLaunch.hero.tagPayPerRun'
    ],
    titleKey: 'cloudNodesLaunch.hero.title',
    titleRestKey: 'cloudNodesLaunch.hero.titleRest',
    descriptionKey: 'cloudNodesLaunch.hero.description',
    primaryCta: {
      labelKey: 'cloudNodesLaunch.hero.primaryCta',
      href: GET_STARTED,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'cloudNodesLaunch.hero.secondaryCta',
      href: externalLinks.pricing,
      target: '_blank'
    }
  },
  steps: {
    headingKey: 'cloudNodesLaunch.steps.heading',
    stepLabelKey: 'cloudNodesLaunch.steps.step',
    items: [
      {
        id: 'update-comfyui',
        title: {
          en: 'Update to v0.34.5 or later',
          'zh-CN': '更新到 v0.34.5 或更高版本'
        },
        description: {
          // Always "or later": a bare version reads as "only this version".
          en: 'The Comfy Cloud nodes ship in ComfyUI v0.34.5. Update and restart, and they appear in the node library alongside every other partner node.',
          'zh-CN':
            'Comfy Cloud 节点随 ComfyUI v0.34.5 发布。更新并重启后，它们会与其他合作伙伴节点一同出现在节点库中。'
        }
      },
      {
        id: 'drop-in-a-node',
        title: { en: 'Drop one into your graph', 'zh-CN': '拖入你的工作流' },
        description: {
          en: 'Search the node library for "Comfy Cloud". Wire it up like any other node.',
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
      labelKey: 'cloudNodesLaunch.steps.primaryCta',
      href: GET_STARTED,
      target: '_blank'
    }
  },
  faq: {
    headingKey: 'cloudNodesLaunch.faq.heading',
    items: [
      {
        // Every node ships a [BETA] suffix in its display name, so the page has
        // to say what that means before someone spends credits finding out.
        id: 'beta',
        question: {
          en: 'Why are these marked beta?',
          'zh-CN': '为什么这些节点标记为测试版？'
        },
        answer: {
          en: 'Because the curated set is still changing: nodes may gain or lose options, and a workflow may be retired. It is not a statement about reliability, runs are real and are billed the same as any other partner node. The [BETA] marker is on the node name itself so you see it before you use one.',
          'zh-CN':
            '因为精选节点集仍在调整：节点的选项可能增减，某个工作流也可能被下线。这与稳定性无关，运行是真实的，计费方式与其他合作伙伴节点一致。[BETA] 标记就在节点名称上，你在使用前就能看到。'
        }
      },
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
        // Count matches `get_node_list()` in comfy_api_nodes/nodes_comfy_cloud.py,
        // which registers eight of the nine node classes the file defines.
        id: 'which-models',
        question: {
          en: 'Which models can I run?',
          'zh-CN': '可以运行哪些模型？'
        },
        answer: {
          en: 'Eight nodes at launch. Four text-to-image (Flux 2, Mage Flow, Mage Flow Turbo, Z-Image Turbo), three MiniMax H3 video nodes (text, image, and first-last frame to video), and MiniMax Music 3 for audio.',
          'zh-CN':
            '首发八个节点：四个文生图（Flux 2、Mage Flow、Mage Flow Turbo、Z-Image Turbo），三个 MiniMax H3 视频节点（文生视频、图生视频、首尾帧生视频），以及用于音频的 MiniMax Music 3。'
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
    headingKey: 'cloudNodesLaunch.runOptions.heading',
    subtitleKey: 'cloudNodesLaunch.runOptions.subtitle',
    ctaKey: 'cloudNodesLaunch.runOptions.cta'
  },
  reviews: {
    headingKey: 'cloudNodesLaunch.reviews.heading',
    highlight: {
      titleKey: 'cloudNodesLaunch.reviews.highlightTitle',
      descriptionKey: 'cloudNodesLaunch.reviews.highlightDescription',
      ctaKey: 'cloudNodesLaunch.reviews.highlightCta'
    }
  }
}
