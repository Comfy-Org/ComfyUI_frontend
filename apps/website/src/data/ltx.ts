import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const ltxLinks = {
  cloudRun: 'https://cloud.comfy.org/?template=video_ltx2_5_i2v',
  cloudRunPremium: 'https://cloud.comfy.org/?template=api_ltx2_5_flf2v',
  hubModel: `${externalLinks.workflows}/model/ltx`,
  blogPost: 'https://blog.comfy.org/p/ltx-25-day-0-support-in-comfyui',
  docs: 'https://docs.comfy.org/tutorials/video/ltx/ltx-2-5'
} as const

const media = {
  hero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/hero.mp4',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/hero-poster.webp'
  },
  blackbird: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-1.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-1.webp'
  },
  circuitry: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-2.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-2.webp'
  },
  portrait: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-3.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-3.webp'
  },
  drones: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-4.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-4.webp'
  },
  astronaut: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-5.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-5.webp'
  },
  horseman: {
    kind: 'video',
    src: 'https://media.comfy.org/website/ltx-2.5/card-6.webm',
    posterSrc: 'https://media.comfy.org/website/ltx-2.5/card-6.webp'
  }
} as const satisfies Record<string, ModelLaunchMedia>

const freeNote = { en: 'Included free', 'zh-CN': '免费包含' }
const premiumNote = { en: 'Pay-as-you-go', 'zh-CN': '按量付费' }
const modelName = { en: 'LTX 2.5', 'zh-CN': 'LTX 2.5' }

export const ltxPage: ModelLaunchPage = {
  metaTitleKey: 'ltx.meta.title',
  metaDescriptionKey: 'ltx.meta.description',
  breadcrumbLabelKey: 'ltx.breadcrumb.model',
  breadcrumbUpdatedKey: 'ltx.breadcrumb.updated',
  hero: {
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    titleKey: 'ltx.hero.title',
    descriptionKey: 'ltx.hero.description',
    primaryCta: {
      labelKey: 'ltx.hero.primaryCta',
      href: ltxLinks.cloudRun,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'ltx.hero.secondaryCta',
      href: ltxLinks.hubModel,
      target: '_blank'
    },
    badgeKeys: [
      'ltx.hero.tagOpenSource',
      'ltx.hero.tagImageToVideo',
      'ltx.hero.tagTextToVideo',
      'ltx.hero.tagPartnerNode'
    ]
  },
  gallery: {
    headingKey: 'ltx.models.heading',
    cards: [
      {
        id: 'blackbird',
        name: modelName,
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A fighter jet banks hard over a stormy, moonlit sea.',
          'zh-CN': '战斗机在月光下的风暴海面上急转倾斜。'
        },
        media: media.blackbird,
        href: ltxLinks.cloudRun
      },
      {
        id: 'circuitry',
        name: modelName,
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Luminous figure drinks from a flower-filled glass.',
          'zh-CN': '发光的人像举起插着白花的玻璃杯饮下。'
        },
        media: media.circuitry,
        href: ltxLinks.cloudRun
      },
      {
        id: 'portrait',
        name: modelName,
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A weathered face stares out from deep shadow.',
          'zh-CN': '饱经风霜的面孔从深深的阴影中凝视。'
        },
        media: media.portrait,
        href: ltxLinks.cloudRun
      },
      {
        id: 'drones',
        name: modelName,
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Heavy-lift drones haul goats across a misty mountain range.',
          'zh-CN': '重型无人机吊运山羊飞越雾气缭绕的山脉。'
        },
        media: media.drones,
        href: ltxLinks.cloudRun
      },
      {
        id: 'astronaut',
        name: modelName,
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A frost-covered astronaut gazes up at the aurora.',
          'zh-CN': '覆霜的宇航员仰望极光。'
        },
        media: media.astronaut,
        href: ltxLinks.cloudRunPremium
      },
      {
        id: 'horseman',
        name: modelName,
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A coated rider and horse stand atop the clouds above Earth.',
          'zh-CN': '身披长衣的骑手与马伫立云端，俯瞰地球。'
        },
        media: media.horseman,
        href: ltxLinks.cloudRunPremium
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'ltx.pricing.banner.title',
      subtitleKey: 'ltx.pricing.banner.subtitle',
      cta: {
        labelKey: 'ltx.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'ltx.faq.heading',
    items: [
      {
        id: 'what-is-ltx',
        question: {
          en: 'What is LTX-2.5?',
          'zh-CN': 'LTX-2.5 是什么？'
        },
        answer: {
          en: `LTX-2.5 is Lightricks' open-weights video and world model, the latest release in the LTX line after LTX-2 and LTX-2.3. It generates synchronized video and audio in a single pass and adds native multishot, so one generation holds character, lighting, and voice across several connected shots. Read the full announcement on [the Comfy blog](${ltxLinks.blogPost}).`,
          'zh-CN': `LTX-2.5 是 Lightricks 的开放权重视频与世界模型，是继 LTX-2 与 LTX-2.3 之后 LTX 系列的最新版本。它能在一次生成中同步输出视频与音频，并新增原生 multishot 能力，让一次生成就能在多个连贯镜头之间保持角色、光线与配音的一致性。完整公告见[Comfy 博客](${ltxLinks.blogPost})。`
        }
      },
      {
        id: 'day-0-support',
        question: {
          en: 'What does day 0 support mean?',
          'zh-CN': '"Day 0 支持" 是什么意思？'
        },
        answer: {
          en: `ComfyUI shipped native nodes and templates for LTX-2.5 the same day Lightricks released the model, so there is no custom node pack to install and no community port to wait on. See [the announcement](${ltxLinks.blogPost}) for details.`,
          'zh-CN': `Lightricks 发布 LTX-2.5 当天，ComfyUI 就同步上线了原生节点与模板，因此你不需要安装第三方节点包，也不用等待社区移植版本。详情见[公告](${ltxLinks.blogPost})。`
        }
      },
      {
        id: 'whats-new',
        question: {
          en: "What's new in LTX-2.5?",
          'zh-CN': 'LTX-2.5 有哪些新特性？'
        },
        answer: {
          en: `LTX-2.5 adds a Diffusion Fidelity Rendering pipeline, a Diffusion Video Decoder for sharper faces and legible text, a Gemma 4 12B text encoder for complex multi-subject prompts, a built-in prompt enhancer, auto duration prediction, and native 4K HDR output at up to 50 FPS. [The docs](${ltxLinks.docs}) cover each workflow in detail.`,
          'zh-CN': `LTX-2.5 新增了 Diffusion Fidelity Rendering 渲染管线、让人脸更清晰、文字更易读的 Diffusion Video Decoder、面向复杂多主体提示词的 Gemma 4 12B 文本编码器，还有内置提示词增强器、自动时长预测，并支持原生 4K HDR、最高 50 FPS 输出。[文档](${ltxLinks.docs})详细介绍了每种工作流。`
        }
      },
      {
        id: 'find-workflows',
        question: {
          en: 'Where do I find LTX-2.5 workflows in ComfyUI?',
          'zh-CN': '在 ComfyUI 中去哪里找 LTX-2.5 工作流？'
        },
        answer: {
          en: `Open the Template Library, then Video, and pick an LTX-2.5 template: Text-to-Video, Image-to-Video, or FLF2V (first-last-frame). Each template links to a downloadable workflow and a one-click run on Comfy Cloud. Full setup steps are in [the docs](${ltxLinks.docs}).`,
          'zh-CN': `打开 Template Library，进入 Video 分类，选择一个 LTX-2.5 模板：Text-to-Video、Image-to-Video 或 FLF2V（首尾帧）。每个模板都附带可下载的工作流，并支持在 Comfy Cloud 上一键运行。完整设置步骤见[文档](${ltxLinks.docs})。`
        }
      },
      {
        id: 'hardware-requirements',
        question: {
          en: 'What hardware do I need to run LTX-2.5 locally?',
          'zh-CN': '在本地运行 LTX-2.5 需要什么硬件？'
        },
        answer: {
          en: `The native ComfyUI workflow uses an int8-quantized, distilled 22B-parameter checkpoint built for consumer GPUs. If you would rather skip local hardware, the LTX-2.5 API nodes run generation on Lightricks' servers instead. [The docs](${ltxLinks.docs}) have the full hardware notes.`,
          'zh-CN': `原生 ComfyUI 工作流使用经过 int8 量化的 22B 参数蒸馏 checkpoint，专为消费级 GPU 设计。如果你想跳过本地硬件，LTX-2.5 的 API 节点会在 Lightricks 的服务器上完成生成。完整硬件说明见[文档](${ltxLinks.docs})。`
        }
      },
      {
        id: 'learn-more',
        question: {
          en: 'Where can I learn more?',
          'zh-CN': '在哪里可以了解更多？'
        },
        answer: {
          en: `Read the full announcement on [the Comfy blog](${ltxLinks.blogPost}), or check [the ComfyUI docs](${ltxLinks.docs}) for setup steps, checkpoints, and prompting tips.`,
          'zh-CN': `完整公告见[Comfy 博客](${ltxLinks.blogPost})，或查看[ComfyUI 文档](${ltxLinks.docs})获取设置步骤、checkpoint 与提示词技巧。`
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'ltx.runOptions.heading',
    subtitleKey: 'ltx.runOptions.subtitle',
    ctaKey: 'ltx.runOptions.cta'
  },
  reviews: {
    headingKey: 'ltx.reviews.heading',
    highlight: {
      titleKey: 'ltx.reviews.highlightTitle',
      descriptionKey: 'ltx.reviews.highlightDescription',
      ctaKey: 'ltx.reviews.highlightCta'
    }
  }
}
