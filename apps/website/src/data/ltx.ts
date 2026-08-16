import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const ltxLinks = {
  cloudRun: 'https://cloud.comfy.org/?template=video_ltx2_5_i2v',
  cloudRunPremium: 'https://cloud.comfy.org/?template=api_ltx2_5_flf2v',
  hubModel: `${externalLinks.workflows}/model/ltx`
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
          en: 'What is LTX 2.5?',
          'zh-CN': 'LTX 2.5 是什么？'
        },
        answer: {
          en: "LTX 2.5 is the newest version of LTX's open video model, with day-0 support in ComfyUI. Weights are downloadable, and it runs fast on local GPUs. Native 4K, synchronized audio and video, and frame rates up to 50fps.",
          'zh-CN':
            'LTX 2.5 是 LTX 开源视频模型的最新版本，在 ComfyUI 中提供首日支持。权重可下载，在本地 GPU 上运行速度很快。原生 4K、音视频同步，帧率最高 50fps。'
        }
      },
      {
        id: 'whats-new-in-25',
        question: {
          en: "What's new in LTX 2.5 vs LTX 2.3?",
          'zh-CN': 'LTX 2.5 相比 LTX 2.3 有哪些新变化？'
        },
        answer: {
          en: 'LTX 2.5 improves the full generation stack rather than a single stage. New in this release: Diffusion Fidelity Rendering, a diffusion video decoder, a custom text encoder, a reworked distilled variant, a prompt enhancer, and a base checkpoint built for adaptation. Native 4K, synchronized audio, and up to 50fps carry over from 2.3.',
          'zh-CN':
            'LTX 2.5 改进的是整个生成流程，而不是单一环节。本次发布的新内容包括：Diffusion Fidelity Rendering、扩散视频解码器、自定义文本编码器、重新设计的蒸馏版本、提示词增强器，以及为适配训练打造的基础检查点。原生 4K、音视频同步与最高 50fps 由 2.3 延续而来。'
        }
      },
      {
        id: 'diffusion-fidelity-rendering',
        question: {
          en: 'What is Diffusion Fidelity Rendering?',
          'zh-CN': '什么是 Diffusion Fidelity Rendering？'
        },
        answer: {
          en: 'The core change in this release. Instead of spending compute evenly across a scene, the model allocates it by complexity. Structure comes first: motion, composition, and framing generate in an 8x temporally compressed latent space, alongside a set of high-fidelity keyframes, more for complex scenes and fewer for simple ones.\n\nA dedicated pixel-diffusion stage then renders the final video from structure and keyframes together. Textures, materials, intricate objects, and faces resolve with pixel-level precision, and busy shots draw more rendering compute than static ones.',
          'zh-CN':
            '这是本次发布的核心变化。模型不再把算力均匀分配到整个画面，而是按复杂度分配。先生成结构：运动、构图与取景在 8 倍时间压缩的潜空间中生成，同时产出一组高保真关键帧，复杂镜头多一些，简单镜头少一些。\n\n随后由专门的像素扩散阶段，结合结构与关键帧渲染出最终视频。纹理、材质、精细物体与人物面部都能达到像素级精度，画面越繁复，分配到的渲染算力就越多。'
        }
      },
      {
        id: 'which-variant',
        question: {
          en: 'Which LTX 2.5 variant should I use?',
          'zh-CN': '我应该使用哪个 LTX 2.5 版本？'
        },
        answer: {
          en: 'Open weights you run yourself. LTX 2.5 dev is the main model. LTX 2.5 distilled is a smaller, faster variant that now carries more quality, prompt adherence, and motion than earlier distilled releases.\n\nThrough Partner Nodes. LTX 2.5 (Fast) covers the wider envelope at 2 to 20 seconds, 720p through 4K, landscape or portrait, at 24, 25, 48, or 50fps. LTX 2.5 (Pro) runs 2 to 10 seconds at 720p or 1080p, at 24, 25, or 50fps.',
          'zh-CN':
            '自行运行的开放权重。LTX 2.5 dev 是主力模型。LTX 2.5 distilled 是体积更小、速度更快的版本，在画质、提示词遵循度与运动表现上都优于此前的蒸馏版本。\n\n通过合作伙伴节点运行。LTX 2.5 (Fast) 覆盖更宽的范围：2 到 20 秒，720p 至 4K，横屏或竖屏，帧率 24、25、48 或 50fps。LTX 2.5 (Pro) 支持 2 到 10 秒，720p 或 1080p，帧率 24、25 或 50fps。'
        }
      },
      {
        id: 'run-in-comfyui',
        question: {
          en: 'How do I run LTX 2.5 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 LTX 2.5？'
        },
        answer: {
          en: '1. Update ComfyUI to 0.32.0, or open Comfy Cloud.\n2. Download the [LTX 2.5 weights](https://huggingface.co/Lightricks/LTX-2.5) from Hugging Face and place them in your models directory.\n3. Load the LTX 2.5 template from the Templates panel: T2V, I2V, or FLF2V.\n4. Add your prompt and input images, then run.',
          'zh-CN':
            '1. 将 ComfyUI 更新到 0.32.0，或打开 Comfy Cloud。\n2. 从 Hugging Face 下载 [LTX 2.5 权重](https://huggingface.co/Lightricks/LTX-2.5)，放入你的模型目录。\n3. 在模板面板中加载 LTX 2.5 模板：T2V、I2V 或 FLF2V。\n4. 填入提示词和输入图像，然后运行。'
        }
      },
      {
        id: 'clip-length',
        question: {
          en: 'How long can LTX 2.5 videos be?',
          'zh-CN': 'LTX 2.5 能生成多长的视频？'
        },
        answer: {
          en: 'Through Partner Nodes, Fast runs 2 to 20 seconds, with clips over 10 seconds capped at 720p or 1080p and 24 or 25fps. Pro runs 2 to 10 seconds. LTX 2.5 also ships an experimental duration head that reads the action in your prompt and sets clip length before diffusion starts.',
          'zh-CN':
            '通过合作伙伴节点，Fast 支持 2 到 20 秒，超过 10 秒的片段上限为 720p 或 1080p、24 或 25fps。Pro 支持 2 到 10 秒。LTX 2.5 还提供一个实验性的时长预测模块，它会读取提示词中的动作，在扩散开始前确定片段长度。'
        }
      },
      {
        id: 'native-audio',
        question: {
          en: 'Does LTX 2.5 generate audio?',
          'zh-CN': 'LTX 2.5 会生成音频吗？'
        },
        answer: {
          en: 'Yes. Synchronized audio and video carry over from LTX 2.3, and multi-shot generations hold voice across cuts.',
          'zh-CN':
            '会。音视频同步由 LTX 2.3 延续而来，多镜头生成还能在镜头切换之间保持人物声音一致。'
        }
      },
      {
        id: 'multi-shot',
        question: {
          en: 'Can LTX 2.5 generate more than one shot?',
          'zh-CN': 'LTX 2.5 能生成多个镜头吗？'
        },
        answer: {
          en: 'Yes. One generation produces multiple connected shots, holding character, environment, lighting, voice, and style across the cuts. You get a sequence from a single run instead of matching separate generations afterward.',
          'zh-CN':
            '可以。一次生成即可产出多个连贯镜头，并在镜头切换之间保持人物、环境、光线、声音与风格一致。你只需运行一次就能得到完整段落，无需事后手动匹配多次生成的结果。'
        }
      },
      {
        id: 'is-it-free',
        question: {
          en: 'Is LTX 2.5 free to use?',
          'zh-CN': 'LTX 2.5 可以免费使用吗？'
        },
        answer: {
          en: 'Open weights are free to download and run on your own hardware. Running LTX 2.5 through Partner Nodes is pay-as-you-go and uses credits.',
          'zh-CN':
            '开放权重可免费下载并在你自己的硬件上运行。通过合作伙伴节点运行 LTX 2.5 为按量付费，消耗额度。'
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
