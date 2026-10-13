import type { ModelLaunchPage } from '@/templates/model-launch/types'

import { externalLinks } from '@/config/routes'

const DOCS_HREF =
  'https://docs.comfy.org/tutorials/partner-nodes/fishaudio/drama-3'
const HERO_POSTER_SRC =
  'https://media.comfy.org/website/fish-audio/fish-audio-poster.jpg'

export const fishAudioPage: ModelLaunchPage = {
  metaTitleKey: 'fishAudio.meta.title',
  metaDescriptionKey: 'fishAudio.meta.description',
  breadcrumbLabelKey: 'fishAudio.breadcrumb.model',
  breadcrumbUpdatedKey: 'fishAudio.breadcrumb.updated',
  hero: {
    videoSrc: 'https://media.comfy.org/website/fish-audio/fish-audio-hero2.mp4',
    posterSrc: HERO_POSTER_SRC,
    titleKey: 'fishAudio.hero.titleModel',
    titleRestKey: 'fishAudio.hero.titleRest',
    descriptionKey: 'fishAudio.hero.description',
    secondaryCta: {
      labelKey: 'fishAudio.hero.secondaryCta',
      href: DOCS_HREF,
      target: '_blank'
    },
    badgeKeys: [
      'fishAudio.hero.badge1',
      'fishAudio.hero.badge2',
      'fishAudio.hero.badge3'
    ]
  },
  sectionOrder: ['steps', 'faq', 'pricing', 'highlight'],
  steps: {
    headingKey: 'fishAudio.steps.heading',
    stepLabelKey: 'fishAudio.steps.step',
    secondaryCta: {
      labelKey: 'fishAudio.steps.secondaryCta',
      href: DOCS_HREF,
      target: '_blank'
    },
    items: [
      {
        id: 'open-comfy-cloud',
        title: { en: 'Open Comfy Cloud', 'zh-CN': '打开 Comfy Cloud' },
        description: {
          en: 'Sign in or create a free account',
          'zh-CN': '登录或免费创建账号'
        }
      },
      {
        id: 'find-the-node',
        title: { en: 'Select Drama 3', 'zh-CN': '选择 Drama 3' },
        description: {
          en: 'Add the Fish Audio Text to Speech node from partner nodes and set model to drama-3',
          'zh-CN':
            '从合作伙伴节点中添加 Fish Audio Text to Speech 节点，并将 model 设为 drama-3'
        }
      },
      {
        id: 'write-the-scene',
        title: { en: 'Direct the scene', 'zh-CN': '执导场景' },
        description: {
          en: 'Add your voices, write the dialogue, and run it',
          'zh-CN': '添加声音，写下对白，运行即可'
        }
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'fishAudio.pricing.banner.title',
      subtitleKey: 'fishAudio.pricing.banner.subtitle',
      cta: {
        labelKey: 'fishAudio.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'fishAudio.faq.heading',
    items: [
      {
        id: 'what-is-drama-3',
        question: {
          en: 'What is Fish Audio Drama 3?',
          'zh-CN': 'Fish Audio Drama 3 是什么？'
        },
        answer: {
          en: "Fish Audio's newest model, and the one it calls its most emotive and controllable yet. You write a multi-character scene and set the direction, and Drama 3 performs it as a single conversation. It runs in the Fish Audio Text to Speech node, in Comfy Cloud and in local ComfyUI 0.39.3 or newer.",
          'zh-CN':
            'Fish Audio 的最新模型，也是 Fish Audio 称为迄今最富情感、最可控的一款。你写下多角色场景并给出表演指示，Drama 3 会把它作为一段对话完整演绎。它在 Fish Audio Text to Speech 节点中运行，支持 Comfy Cloud 和 0.39.3 及以上版本的本地 ComfyUI。'
        }
      },
      {
        id: 'how-to-try',
        question: {
          en: 'How do I try Drama 3 in Comfy Cloud?',
          'zh-CN': '如何在 Comfy Cloud 中试用 Drama 3？'
        },
        answer: {
          en: `Open [Comfy Cloud](${externalLinks.cloud}) and search the Template Library for Fish Audio Drama 3, or add the Fish Audio Text to Speech node from partner nodes and set model to drama-3. Add your voices, write the dialogue, and run it.`,
          'zh-CN': `打开 [Comfy Cloud](${externalLinks.cloud})，在模板库中搜索 Fish Audio Drama 3，或从合作伙伴节点中添加 Fish Audio Text to Speech 节点并将 model 设为 drama-3。添加声音，写下对白，运行即可。`
        }
      },
      {
        id: 'launch-offer',
        question: {
          en: 'What is the launch offer?',
          'zh-CN': '首发优惠是什么？'
        },
        answer: {
          en: `From October 13 to November 12, 2026, Drama 3 is 60% off in Comfy Cloud. The standard rate applies from November 13, and current rates are in the [Drama 3 docs](${DOCS_HREF}). Open [Comfy Cloud](${externalLinks.cloud}) to start.`,
          'zh-CN': `2026 年 10 月 13 日至 11 月 12 日，Drama 3 在 Comfy Cloud 中享 4 折优惠，11 月 13 日起恢复标准价格，当前费率见 [Drama 3 文档](${DOCS_HREF})。打开 [Comfy Cloud](${externalLinks.cloud}) 即可开始。`
        }
      },
      {
        id: 'scene-in-a-workflow',
        question: {
          en: 'How does a scene fit into a workflow?',
          'zh-CN': '场景如何融入工作流？'
        },
        answer: {
          en: 'Drama 3 runs in the Fish Audio Text to Speech node, so it fits into a Comfy workflow like any other node. Build the scene and its audio in one graph. Change a line, run again, and everything downstream picks up the new take.',
          'zh-CN':
            'Drama 3 在 Fish Audio Text to Speech 节点中运行，因此和其他节点一样融入 Comfy 工作流。在同一个工作流中构建场景和它的音频。改一句台词，再运行一次，下游的每个环节都会用上新的演绎。'
        }
      },
      {
        id: 'open-weights',
        question: {
          en: 'Is Drama 3 open weights?',
          'zh-CN': 'Drama 3 是开源权重吗？'
        },
        answer: {
          en: "No. Drama 3 runs through Fish Audio's API, so there is nothing to download and no GPU to provision.",
          'zh-CN':
            '不是。Drama 3 通过 Fish Audio API 运行，无需下载任何内容，也无需配置 GPU。'
        }
      },
      {
        id: 'other-fish-audio-nodes',
        question: {
          en: 'What do the other Fish Audio nodes do?',
          'zh-CN': '其他 Fish Audio 节点有什么用？'
        },
        answer: {
          en: 'Text to Speech also runs S2.1 Pro and S1, which take emotion cues in the text. Speech to Text transcribes audio with automatic language detection, and Instant Voice Clone makes a private voice from 1 to 20 recordings. Voice Selector is where you pick a voice from the Fish Audio library, and all four are in the [Fish Audio docs](https://docs.comfy.org/tutorials/partner-nodes/fishaudio/fish-audio).',
          'zh-CN':
            'Text to Speech 还可运行 S2.1 Pro 和 S1，支持在文本中加入情绪提示。Speech to Text 自动检测语言并转写音频，Instant Voice Clone 用 1 到 20 段录音生成私有声音。Voice Selector 用于从 Fish Audio 声音库中挑选声音。这四个节点都收录在 [Fish Audio 文档](https://docs.comfy.org/tutorials/partner-nodes/fishaudio/fish-audio)中。'
        }
      },
      {
        id: 'clone-a-voice',
        question: {
          en: 'Can I clone a voice with the Fish Audio nodes?',
          'zh-CN': '我可以用 Fish Audio 节点克隆声音吗？'
        },
        answer: {
          en: 'Yes, with the Fish Audio Instant Voice Clone node: connect 1 to 20 recordings, under 270 seconds in total and ideally 10 to 30 seconds each, and the cloned voice feeds straight into the Fish Audio Text to Speech node with no training wait. Voice cloning is free. Clone only voices you have permission to use.',
          'zh-CN':
            '可以，使用 Fish Audio Instant Voice Clone 节点：连接 1 到 20 段录音，总时长不超过 270 秒，每段以 10 到 30 秒为佳，克隆出的声音会直接接入 Fish Audio Text to Speech 节点，无需等待训练。声音克隆免费。请只克隆你有权使用的声音。'
        }
      },
      {
        id: 'other-nodes-pricing',
        question: {
          en: 'How are Text to Speech and Speech to Text priced?',
          'zh-CN': 'Text to Speech 和 Speech to Text 如何计费？'
        },
        answer: {
          en: 'Per use, through your ComfyUI account. Text to speech is metered by text length and speech to text by the minute. Current rates are in the [Fish Audio docs](https://docs.comfy.org/tutorials/partner-nodes/fishaudio/fish-audio).',
          'zh-CN':
            '通过你的 ComfyUI 账号按使用量计费。文本转语音按文本长度计量，语音转文字按分钟计量。当前费率见 [Fish Audio 文档](https://docs.comfy.org/tutorials/partner-nodes/fishaudio/fish-audio)。'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'fishAudio.runOptions.heading',
    subtitleKey: 'fishAudio.runOptions.subtitle',
    ctaKey: 'fishAudio.runOptions.cta'
  },
  highlight: {
    titleKey: 'fishAudio.reviews.highlightTitle',
    descriptionKey: 'fishAudio.reviews.highlightDescription',
    ctaKey: 'fishAudio.reviews.highlightCta'
  },
  reviews: {
    headingKey: 'fishAudio.reviews.heading'
  }
}
