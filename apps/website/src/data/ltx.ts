import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const ltxLinks = {
  cloudRun: 'https://cloud.comfy.org/?template=video_ltx2_5_i2v',
  cloudRunPremium: 'https://cloud.comfy.org/?template=api_ltx2_5_flf2v',
  hubModel: new URL('model/ltx/', externalLinks.workflows).href,
  hfModel: 'https://huggingface.co/Lightricks/LTX-2.5',
  blogPost: 'https://blog.comfy.org/p/ltx-25-day-0-support-in-comfyui',
  docs: 'https://docs.comfy.org/tutorials/video/ltx/ltx-2-5',
  partnerNodes:
    'https://docs.comfy.org/tutorials/partner-nodes/lightricks/ltx-2-5'
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
          en: `LTX-2.5 is the newest version of LTX's open video model, with day 0 support in ComfyUI. Weights are downloadable and it runs fast on local GPUs. Native 4K, synchronized audio and video, and frame rates up to 50 FPS. Read the full announcement on [the Comfy blog](${ltxLinks.blogPost}).`,
          'zh-CN': `LTX-2.5 是 LTX 开放视频模型的最新版本，在 ComfyUI 中实现了 day 0 支持。权重可下载，并能在本地 GPU 上快速运行。支持原生 4K、同步音视频，以及最高 50 FPS 的帧率。完整公告见[Comfy 博客](${ltxLinks.blogPost})。`
        }
      },
      {
        id: 'whats-new',
        question: {
          en: "What's new in LTX-2.5 vs LTX-2.3?",
          'zh-CN': 'LTX-2.5 相比 LTX-2.3 有哪些新变化？'
        },
        answer: {
          en: `LTX-2.5 improves the full generation stack rather than a single stage. New in this release: Diffusion Fidelity Rendering, a diffusion video decoder, a custom text encoder, a reworked distilled variant, a prompt enhancer, and a base checkpoint built for adaptation. Native 4K, synchronized audio, and up to 50 FPS carry over from 2.3. Read the full breakdown on [the Comfy blog](${ltxLinks.blogPost}).`,
          'zh-CN': `LTX-2.5 改进的是整条生成流程，而不是单一环节。本次更新新增：Diffusion Fidelity Rendering、diffusion 视频解码器、定制文本编码器、重新设计的蒸馏版本、提示词增强器，以及为微调而构建的基础 checkpoint。原生 4K、同步音频与最高 50 FPS 则延续自 2.3 版本。完整介绍见[Comfy 博客](${ltxLinks.blogPost})。`
        }
      },
      {
        id: 'diffusion-fidelity-rendering',
        question: {
          en: 'What is Diffusion Fidelity Rendering?',
          'zh-CN': 'Diffusion Fidelity Rendering 是什么？'
        },
        answer: {
          en: 'The core change in this release. Instead of spending compute evenly across a scene, the model allocates it by complexity. Structure comes first: motion, composition, and framing generate in an 8x temporally compressed latent space, alongside a set of high-fidelity keyframes, more for complex scenes and fewer for simple ones. A dedicated pixel-diffusion stage then renders the final video from structure and keyframes together. Textures, materials, intricate objects, and faces resolve with pixel-level precision, and busy shots draw more rendering compute than static ones.',
          'zh-CN':
            '这是本次更新的核心变化。模型不再将算力平均分配到整个场景，而是按复杂度分配。结构信息优先生成：运动、构图与取景在时间维度压缩 8 倍的潜空间中生成，同时生成一组高保真关键帧，场景越复杂，关键帧越多，反之则越少。随后，一个专门的像素级 diffusion 阶段会结合结构信息与关键帧渲染出最终视频。纹理、材质、复杂物体与人脸都能以像素级精度呈现，画面越繁忙，占用的渲染算力也越多。'
        }
      },
      {
        id: 'which-variant',
        question: {
          en: 'Which LTX-2.5 variant should I use?',
          'zh-CN': '应该使用哪个 LTX-2.5 版本？'
        },
        answer: {
          en: `Open weights you run yourself: LTX-2.5 dev is the main model, and LTX-2.5 distilled is a smaller, faster variant that now carries more quality, prompt adherence, and motion than earlier distilled releases. Through [Partner Nodes](${ltxLinks.partnerNodes}): LTX-2.5 (Fast) covers the wider envelope at 2 to 20 seconds, 720p through 4K, landscape or portrait, at 24, 25, 48, or 50 FPS. LTX-2.5 (Pro) runs 2 to 10 seconds at 720p or 1080p, at 24, 25, or 50 FPS.`,
          'zh-CN': `自行运行的开放权重版本：LTX-2.5 dev 是主力模型，LTX-2.5 distilled 是更小、更快的版本，相比早期的蒸馏版本，在质量、提示词遵循度与动作表现上都有提升。通过[Partner Nodes](${ltxLinks.partnerNodes})调用：LTX-2.5（Fast）覆盖更宽的范围，支持 2 到 20 秒、720p 到 4K、横屏或竖屏，帧率为 24、25、48 或 50 FPS。LTX-2.5（Pro）支持 2 到 10 秒，720p 或 1080p，帧率为 24、25 或 50 FPS。`
        }
      },
      {
        id: 'run-in-comfyui',
        question: {
          en: 'How do I run LTX-2.5 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 LTX-2.5？'
        },
        answer: {
          en: `Update ComfyUI to 0.32.0, or open Comfy Cloud. Download [the LTX-2.5 weights](${ltxLinks.hfModel}) and place them in your models directory. Load the LTX-2.5 template from the Templates panel: Text to Video, Image to Video, or FLF2V. Add your prompt and input images, then run. Full setup steps are in [the docs](${ltxLinks.docs}).`,
          'zh-CN': `将 ComfyUI 更新到 0.32.0，或直接打开 Comfy Cloud。下载[LTX-2.5 权重](${ltxLinks.hfModel})并放入你的 models 目录。从 Templates 面板中加载 LTX-2.5 模板：Text to Video、Image to Video 或 FLF2V。填入提示词与输入图像后运行即可。完整设置步骤见[文档](${ltxLinks.docs})。`
        }
      },
      {
        id: 'clip-length',
        question: {
          en: 'How long can LTX-2.5 videos be?',
          'zh-CN': 'LTX-2.5 能生成多长的视频？'
        },
        answer: {
          en: 'Through Partner Nodes, Fast runs 2 to 20 seconds, with clips over 10 seconds capped at 720p or 1080p and 24 or 25 FPS. Pro runs 2 to 10 seconds. LTX-2.5 also ships an experimental duration head that reads the action in your prompt and sets clip length before diffusion starts.',
          'zh-CN':
            '通过 Partner Nodes，Fast 支持 2 到 20 秒，超过 10 秒的片段会限制在 720p 或 1080p、24 或 25 FPS。Pro 支持 2 到 10 秒。LTX-2.5 还配备了一个实验性的时长预测模块，能读取提示词中的动作内容，在 diffusion 开始前就确定片段长度。'
        }
      },
      {
        id: 'native-audio',
        question: {
          en: 'Does LTX-2.5 generate audio?',
          'zh-CN': 'LTX-2.5 会生成音频吗？'
        },
        answer: {
          en: 'Yes. Synchronized audio and video carry over from LTX-2.3, and multi-shot generations hold voice across cuts.',
          'zh-CN':
            '会。同步音视频能力延续自 LTX-2.3，并且在多镜头生成中，配音能在不同镜头之间保持一致。'
        }
      },
      {
        id: 'multi-shot',
        question: {
          en: 'Can LTX-2.5 generate more than one shot?',
          'zh-CN': 'LTX-2.5 能生成多个镜头吗？'
        },
        answer: {
          en: 'Yes. One generation produces multiple connected shots, holding character, environment, lighting, voice, and style across the cuts. You get a sequence from a single run instead of matching separate generations afterward.',
          'zh-CN':
            '能。一次生成就能产出多个连贯的镜头，并在镜头切换之间保持角色、环境、光线、配音与风格的一致性。你可以通过一次运行得到一段连续的序列，而不必事后再拼接多次独立生成的结果。'
        }
      },
      {
        id: 'fine-tuning',
        question: {
          en: 'Can I fine-tune LTX-2.5?',
          'zh-CN': 'LTX-2.5 可以微调吗？'
        },
        answer: {
          en: 'Yes. The base checkpoint is built for adaptation, so you can fine-tune the raw model on your own data.',
          'zh-CN':
            '可以。基础 checkpoint 就是为微调而设计的，因此你可以在自己的数据上微调原始模型。'
        }
      },
      {
        id: 'is-it-free',
        question: {
          en: 'Is LTX-2.5 free to use?',
          'zh-CN': 'LTX-2.5 可以免费使用吗？'
        },
        answer: {
          en: `Open weights are free to download and run on your own hardware. Running LTX-2.5 through Partner Nodes uses credits. See [the docs](${ltxLinks.docs}) for setup details.`,
          'zh-CN': `开放权重可以免费下载，并在你自己的硬件上运行。通过 Partner Nodes 运行 LTX-2.5 需要消耗积分。设置细节见[文档](${ltxLinks.docs})。`
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
