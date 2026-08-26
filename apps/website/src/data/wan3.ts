import type { ModelLaunchPage } from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Wan 3.0 runs through partner nodes rather than open weights. There is no
// Wan 3.0 docs page yet, so nothing here links to one.
const wan3Links = {
  cloudRunTextToVideo: 'https://cloud.comfy.org/?template=api_wan3_0_t2v',
  cloudRunImageToVideo: 'https://cloud.comfy.org/?template=api_wan3_0_i2v',
  cloudRunReferenceToVideo: 'https://cloud.comfy.org/?template=api_wan3_0_r2v',
  hubModel: `${externalLinks.workflows}/model/wan`
} as const

// The hero clip is ~10 MB, so below 768px ModelLaunchHeroSection plays this
// ~4 MB encode instead and phones never fetch the full clip. The poster still
// doubles as the mobile fallback, covering SSR until the player mounts.
const wan3HeroMobileVideoSrc =
  'https://media.comfy.org/website/models/wan_3-0_mobile.mp4'
const wan3HeroStillSrc = 'https://media.comfy.org/website/models/wan_3-0.jpeg'

export const wan3Page: ModelLaunchPage = {
  metaTitleKey: 'wan3.meta.title',
  metaDescriptionKey: 'wan3.meta.description',
  breadcrumbLabelKey: 'wan3.breadcrumb.model',
  breadcrumbUpdatedKey: 'wan3.breadcrumb.updated',
  hero: {
    layout: 'content-first',
    videoSrc: 'https://media.comfy.org/website/models/wan_3-0_v3.mp4',
    posterSrc: wan3HeroStillSrc,
    mobileFallbackImageSrc: wan3HeroStillSrc,
    mobileVideoSrc: wan3HeroMobileVideoSrc,
    logoSrc: '/icons/ai-models/wan.svg',
    titleKey: 'wan3.hero.title',
    descriptionKey: 'wan3.hero.description',
    badgeKeys: [
      'wan3.hero.tagImageToVideo',
      'wan3.hero.tagTextToVideo',
      'wan3.hero.tagReferenceToVideo'
    ],
    primaryCta: {
      labelKey: 'wan3.hero.primaryCta',
      href: wan3Links.cloudRunTextToVideo,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'wan3.hero.secondaryCta',
      href: wan3Links.hubModel,
      target: '_blank'
    }
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'wan3.pricing.banner.title',
      subtitleKey: 'wan3.pricing.banner.subtitle',
      cta: {
        labelKey: 'wan3.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'wan3.faq.heading',
    items: [
      {
        id: 'what-is-wan-3',
        question: {
          en: 'What is Wan 3.0?',
          'zh-CN': 'Wan 3.0 是什么？'
        },
        answer: {
          en: "Alibaba's latest video model. Give it a prompt, up to 20 reference assets, or even a document and it generates up to 30 seconds with native audio.",
          'zh-CN':
            '阿里巴巴最新的视频模型。给它一段提示词、最多 20 个参考素材，甚至一份文档，它就能生成最长 30 秒并带原生音频的视频。'
        }
      },
      {
        id: 'whats-new',
        question: {
          en: "What's new in Wan 3.0 vs Wan 2.7?",
          'zh-CN': 'Wan 3.0 相比 Wan 2.7 有哪些新变化？'
        },
        answer: {
          en: 'Native 30-second clips, up to 20 reference inputs, and 480p generations for quick and cost effective generations.',
          'zh-CN':
            '原生 30 秒片段、最多 20 个参考输入，以及用于快速且低成本生成的 480p 输出。'
        }
      },
      {
        id: 'how-to-run',
        question: {
          en: 'How do I run Wan 3.0 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 Wan 3.0？'
        },
        answer: {
          en: `This model ships with three workflows available in the template library — [reference to video](${wan3Links.cloudRunReferenceToVideo}), [image to video](${wan3Links.cloudRunImageToVideo}) and [text to video](${wan3Links.cloudRunTextToVideo}).`,
          'zh-CN': `该模型在模板库中提供三个工作流 — [参考生视频](${wan3Links.cloudRunReferenceToVideo})、[图生视频](${wan3Links.cloudRunImageToVideo})与[文生视频](${wan3Links.cloudRunTextToVideo})。`
        }
      },
      {
        id: 'prompting',
        question: {
          en: 'How do I prompt Wan 3.0?',
          'zh-CN': '如何为 Wan 3.0 编写提示词？'
        },
        answer: {
          en: 'Start simple: subject, scene, motion — one sentence is enough for a full clip. For more control, layer in camera movement, lighting, style, and sound, or address your uploads directly with @ syntax: "@Image1 walks through the door and says the line from @Audio1." The longer and more precise the prompt, the closer the output tracks your intent — it accepts up to 20,000 characters.',
          'zh-CN':
            '先从简单开始：主体、场景、动作 — 一句话就足以生成完整片段。想要更多控制，可以再叠加运镜、光线、风格与声音，或用 @ 语法直接引用你上传的素材："@Image1 走进门并说出 @Audio1 中的台词。"提示词越长、越精确，输出就越贴近你的意图 — 最多支持 20,000 个字符。'
        }
      },
      {
        id: 'video-editing',
        question: {
          en: 'Can Wan 3.0 edit video I already have?',
          'zh-CN': 'Wan 3.0 可以编辑我已有的视频吗？'
        },
        answer: {
          en: 'Yes. Describe the change — remove an object, relight the scene, swap a subject — and everything else in the frame stays put. It can also extend existing footage.',
          'zh-CN':
            '可以。只需描述你想要的改动 — 移除某个物体、重新布光、替换主体 — 画面中的其他部分都会保持不变。它也可以延展已有素材。'
        }
      },
      {
        id: 'clip-length',
        question: {
          en: 'How long can clips be?',
          'zh-CN': '片段可以有多长？'
        },
        answer: {
          en: 'Anywhere from 2 to 30 seconds, generated in one continuous take — no stitching. Audio is generated natively, or switch it off.',
          'zh-CN':
            '2 到 30 秒均可，一镜到底地连续生成 — 无需拼接。音频为原生生成，也可以关闭。'
        }
      }
    ]
  },
  runOptions: {
    headingKey: 'wan3.runOptions.heading',
    subtitleKey: 'wan3.runOptions.subtitle',
    ctaKey: 'wan3.runOptions.cta'
  },
  reviews: {
    headingKey: 'wan3.reviews.heading',
    highlight: {
      titleKey: 'wan3.reviews.highlightTitle',
      descriptionKey: 'wan3.reviews.highlightDescription',
      ctaKey: 'wan3.reviews.highlightCta'
    }
  }
}
