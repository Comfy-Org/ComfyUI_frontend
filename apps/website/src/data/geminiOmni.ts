import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Gemini Omni 1.1 Flash renders, encoded to the site's web video profile and
// served from media.comfy.org. Each poster is cut from its clip's own opening
// frame, so it registers exactly with the video that replaces it.
//
// `hero` is the launch sizzle (OMNI_FLASH_11_16x9), 1280x720 with audio kept. Its
// poster is the branded title-card frame rather than frame 0, which is mid-wipe
// and reads as an empty box.
//
// The `v2` suffixes are not decoration. Both the hero video and its poster were
// first uploaded under un-versioned keys, and these objects ship
// `cache-control: public,max-age=3600`, so the edge keeps serving the old bytes
// for up to an hour no matter how many times the same key is re-uploaded. A new
// key is the only same-hour bust. Version the filename again on the next swap.
const media = {
  hero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/gemini-omni/hero_v2.mp4',
    posterSrc: 'https://media.comfy.org/website/gemini-omni/hero-poster-v2.webp'
  },
  seasons: {
    kind: 'video',
    src: 'https://media.comfy.org/website/gemini-omni/card-1.webm',
    posterSrc: 'https://media.comfy.org/website/gemini-omni/card-1.webp'
  },
  saxophone: {
    kind: 'video',
    src: 'https://media.comfy.org/website/gemini-omni/card-2.webm',
    posterSrc: 'https://media.comfy.org/website/gemini-omni/card-2.webp'
  },
  vacuum: {
    kind: 'video',
    src: 'https://media.comfy.org/website/gemini-omni/card-3.webm',
    posterSrc: 'https://media.comfy.org/website/gemini-omni/card-3.webp'
  },
  stoneHead: {
    kind: 'video',
    src: 'https://media.comfy.org/website/gemini-omni/card-4.webm',
    posterSrc: 'https://media.comfy.org/website/gemini-omni/card-4.webp'
  },
  cavemen: {
    kind: 'video',
    src: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
    posterSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp'
  },
  hotDogDog: {
    kind: 'video',
    src: 'https://media.comfy.org/website/gemini-omni/card-6.webm',
    posterSrc: 'https://media.comfy.org/website/gemini-omni/card-6.webp'
  }
} as const satisfies Record<string, ModelLaunchMedia>

const geminiOmniLinks = {
  cloudRun:
    'https://cloud.comfy.org/?template=api_google_gemini_omni_flash_1_1_t2v',
  cloudRunVideoEdit:
    'https://cloud.comfy.org/?template=api_google_gemini_omni_flash_1_1_edit',
  // Deliberately not a hub model-family page the way /ltx-2.5 links one. The
  // catalog now tags these entries `models: ['Gemini Omni 1.1 Flash']`, which
  // slugifies to `gemini-omni-1-1-flash`, but that page is still not generated:
  // `deriveModelGroups` requires MIN_CLUSTER_SIZE 5 AND MIN_CLUSTER_USAGE 500,
  // or membership of PRIORITY_MODELS. The cluster has exactly 5 templates and 0
  // usage, and no Gemini entry is a priority model, so the URL 404s until usage
  // builds. Point at the overview workflow, which resolves today.
  hubOverview: 'https://comfy.org/workflows/a0e9a3b16f63-a0e9a3b16f63/'
} as const

// Every card is the same model on pay-as-you-go, which is what the Figma shows:
// the note reads "pay-as-you-go" on all four rather than naming a capability.
const premiumNote = { en: 'Pay-as-you-go', 'zh-CN': '按量付费' }

// Prompts are literal text a reader pastes into the model, so they are not
// translated. Same rule as /seedance-2.5.
const SEASONS_PROMPT =
  'One continuous shot, an extremely sped up seasonal timelapse of the character sitting in that exact position against the cliff rocks. The background composition remains. Only the climate changes from Snowy Winter to Flowers blooming in Spring to Sunshine in Summer to Leaves in Fall. No shot cuts or transitions. Use image 1 as the exact start frame and use image 1 as the exact end frame for a perfect loop'
const SAXOPHONE_PROMPT =
  'Mixed media surreal scene of the man playing the saxophone passionately as he strolls to his right, the camera tracks him. The red graphic elements pulse with each note. He is playing a melody and on the final note his hat flies off his head. 10-second generation.'
const VACUUM_PROMPT = 'Product advertisement for the robot vacuum'
const CAVEMEN_PROMPT =
  'POV: you are a caveman and you and the homies discover fire for the first time. The cavemen speak in Gen Z slang. One continuous shot'
const HOT_DOG_PROMPT =
  'a dog with a hot dog costume eating a huge hot dog at the park, documentary style, natgeo'
const STONE_HEAD_PROMPT =
  'The floating statue says "Blazing fast speed", the elements orbit slowly as they float. 5 second generation\n\nTranslate this into French'

// Annotated rather than `satisfies`, matching /ltx-2.5: `satisfies` keeps the
// literal type, so the absent `faq` is not merely undefined but missing, and
// reading `geminiOmniPage.faq` stops compiling. The e2e spec needs to read it
// to assert the FAQPage structured data agrees with this config.
export const geminiOmniPage: ModelLaunchPage = {
  metaTitleKey: 'geminiOmni.meta.title',
  metaDescriptionKey: 'geminiOmni.meta.description',
  breadcrumbLabelKey: 'geminiOmni.breadcrumb.model',
  breadcrumbUpdatedKey: 'geminiOmni.breadcrumb.updated',
  hero: {
    // No `layout`, which is the media-first default the Figma draws: video,
    // then heading, description, CTAs and badges underneath.
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    logoSrc: '/icons/ai-models/gemini.svg',
    titleKey: 'geminiOmni.hero.titleModel',
    titleRestKey: 'geminiOmni.hero.titleRest',
    descriptionKey: 'geminiOmni.hero.description',
    primaryCta: {
      labelKey: 'geminiOmni.hero.primaryCta',
      href: geminiOmniLinks.cloudRun,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'geminiOmni.hero.secondaryCta',
      href: geminiOmniLinks.hubOverview,
      target: '_blank'
    },
    badgeKeys: [
      'geminiOmni.hero.tagPartnerNode',
      'geminiOmni.hero.tagImageToVideo',
      'geminiOmni.hero.tagTextToVideo',
      'geminiOmni.hero.tagReferenceToVideo'
    ]
  },
  gallery: {
    headingKey: 'geminiOmni.models.heading',
    // The Figma paints the per-card chevron solid yellow, not the muted
    // treatment /minimax ships.
    ctaVariant: 'accent',
    cards: [
      {
        id: 'seasonal-timelapse',
        name: { en: 'Seasonal timelapse', 'zh-CN': '四季延时' },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Winter to spring and back again',
          'zh-CN': '冬去春来，四季轮回'
        },
        prompt: { en: SEASONS_PROMPT, 'zh-CN': SEASONS_PROMPT },
        media: media.seasons,
        href: geminiOmniLinks.cloudRun
      },
      {
        id: 'saxophone-halftone',
        name: { en: 'Saxophone solo', 'zh-CN': '萨克斯独奏' },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Saxophone solo in halftone',
          'zh-CN': '半调风格的萨克斯独奏'
        },
        prompt: { en: SAXOPHONE_PROMPT, 'zh-CN': SAXOPHONE_PROMPT },
        media: media.saxophone,
        href: geminiOmniLinks.cloudRun
      },
      {
        id: 'floor-robot',
        name: { en: 'Floor robot advert', 'zh-CN': '扫地机器人广告' },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Slow push on a floor robot',
          'zh-CN': '缓缓推近的扫地机器人'
        },
        prompt: { en: VACUUM_PROMPT, 'zh-CN': VACUUM_PROMPT },
        media: media.vacuum,
        href: geminiOmniLinks.cloudRun
      },
      {
        id: 'stone-head-speaks',
        name: { en: 'Stone head speaks', 'zh-CN': '石像开口' },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Stone head speaks',
          'zh-CN': '石像开口说话'
        },
        prompt: { en: STONE_HEAD_PROMPT, 'zh-CN': STONE_HEAD_PROMPT },
        media: media.stoneHead,
        // The only card whose prompt names the workflow that made it: it asks
        // for a re-voice in French, which is the video edit template.
        href: geminiOmniLinks.cloudRunVideoEdit
      },
      {
        id: 'cavemen-discover-fire',
        name: { en: 'Cavemen discover fire', 'zh-CN': '穴居人发现火' },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'Cavemen meet the future',
          'zh-CN': '穴居人遇见未来'
        },
        prompt: { en: CAVEMEN_PROMPT, 'zh-CN': CAVEMEN_PROMPT },
        media: media.cavemen,
        href: geminiOmniLinks.cloudRun
      },
      {
        id: 'dog-with-hot-dog',
        name: { en: 'Dog in a hot dog costume', 'zh-CN': '穿热狗装的狗' },
        tier: 'premium',
        note: premiumNote,
        description: {
          en: 'A dog with hot dog',
          'zh-CN': '狗与热狗'
        },
        prompt: { en: HOT_DOG_PROMPT, 'zh-CN': HOT_DOG_PROMPT },
        media: media.hotDogDog,
        href: geminiOmniLinks.cloudRun
      }
    ]
  },
  steps: {
    headingKey: 'geminiOmni.steps.heading',
    stepLabelKey: 'geminiOmni.steps.step',
    items: [
      {
        id: 'upload-references',
        title: {
          en: 'Upload your reference assets',
          'zh-CN': '上传你的参考素材'
        }
      },
      {
        id: 'prompt-the-scene',
        title: { en: 'Prompt the scene', 'zh-CN': '描述你的场景' },
        description: {
          en: 'Camera, action, timing, dialogue',
          'zh-CN': '运镜、动作、节奏、对白'
        }
      },
      {
        id: 'generate-your-shot',
        title: { en: 'Generate your shot', 'zh-CN': '生成你的镜头' },
        description: {
          en: 'Up to 10 seconds at 4k.',
          'zh-CN': '最长 10 秒，最高 4K。'
        }
      }
    ],
    // One button, and the Figma draws it as the outline treatment, which on
    // this template is the secondary slot. No primary CTA by design.
    secondaryCta: {
      labelKey: 'geminiOmni.steps.secondaryCta',
      href: geminiOmniLinks.cloudRun,
      target: '_blank'
    }
  },
  pricing: {
    // The Figma opens this page on monthly, unlike the /pricing page.
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'geminiOmni.pricing.banner.title',
      subtitleKey: 'geminiOmni.pricing.banner.subtitle',
      cta: {
        labelKey: 'geminiOmni.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  // Rob's Q&A copy. The Figma's block was still Seedance 2.0 placeholder text.
  // The source doc repeats "Can Gemini Omni 1.1 Flash extend a video?" twice with
  // an identical answer; it appears once here, because this feeds the FAQPage
  // JSON-LD and a repeated question would be published to search engines twice.
  faq: {
    headingKey: 'geminiOmni.faq.heading',
    items: [
      {
        id: 'what-is-omni-flash',
        question: {
          en: 'What is Gemini Omni 1.1 Flash?',
          'zh-CN': '什么是 Gemini Omni 1.1 Flash？'
        },
        answer: {
          en: "Gemini Omni 1.1 Flash is Google's multimodal video model, built for fast video generation, editing, and cinematic control. It processes text, image, audio, and video together, generates clips with an audio track, and edits existing video from plain-language instructions. It replaces earlier versions of Gemini Omni Flash.",
          'zh-CN':
            'Gemini Omni 1.1 Flash 是 Google 的多模态视频模型，为快速视频生成、编辑与运镜控制而打造。它同时处理文本、图像、音频与视频，生成自带音轨的片段，并可依据自然语言指令编辑已有视频。它取代了此前各版本的 Gemini Omni Flash。'
        }
      },
      {
        id: 'extend-a-video',
        question: {
          en: 'Can Gemini Omni 1.1 Flash extend a video?',
          'zh-CN': 'Gemini Omni 1.1 Flash 可以延长视频吗？'
        },
        answer: {
          en: 'Yes. With task type set to extend, Gemini Omni 1.1 Flash reads the prior motion and composition of a clip and continues the shot, holding character identity and lighting steady. A prompt like "continue the shot: the woman finishes the violin solo and takes a bow" picks up where the clip ends.',
          'zh-CN':
            '可以。将任务类型设为 extend 后，Gemini Omni 1.1 Flash 会读取片段此前的运动与构图并延续该镜头，同时保持人物特征与光照一致。诸如「continue the shot: the woman finishes the violin solo and takes a bow」这样的提示词，会从片段结束处接续下去。'
        }
      },
      {
        id: 'commercial-use',
        question: {
          en: 'Can I use Gemini Omni 1.1 Flash commercially?',
          'zh-CN': '我可以将 Gemini Omni 1.1 Flash 用于商业用途吗？'
        },
        answer: {
          en: "Yes. Output generated through ComfyUI partner nodes can be used in commercial work, subject to ComfyUI's terms and Google's usage policies. All videos carry a SynthID watermark, which is invisible to viewers but programmatically detectable for provenance.",
          'zh-CN':
            '可以。通过 ComfyUI 合作伙伴节点生成的内容可用于商业作品，但须遵守 ComfyUI 的条款与 Google 的使用政策。所有视频都带有 SynthID 水印，观众无法察觉，但可通过程序检测以追溯来源。'
        }
      },
      {
        id: 'resolutions-and-aspect-ratios',
        question: {
          en: 'What resolutions and aspect ratios does Gemini Omni 1.1 Flash support in ComfyUI?',
          'zh-CN':
            '在 ComfyUI 中，Gemini Omni 1.1 Flash 支持哪些分辨率和宽高比？'
        },
        answer: {
          en: 'The Gemini Video Omni node outputs Gemini Omni 1.1 Flash video at 360p, 720p, 1080p, or 4K, in 16:9 or 9:16. Landscape is the default; set 9:16 for vertical clips. Higher resolutions take longer to generate.',
          'zh-CN':
            'Gemini Video Omni 节点可输出 360p、720p、1080p 或 4K 的 Gemini Omni 1.1 Flash 视频，宽高比为 16:9 或 9:16。默认是横屏；竖屏片段请设为 9:16。分辨率越高，生成耗时越长。'
        }
      },
      {
        id: 'edit-an-existing-video',
        question: {
          en: 'Can Gemini Omni 1.1 Flash edit an existing video?',
          'zh-CN': 'Gemini Omni 1.1 Flash 可以编辑已有视频吗？'
        },
        answer: {
          en: 'Yes. Connect a clip to the node\'s video input and describe the change, and Gemini Omni 1.1 Flash applies it while preserving everything else. Short prompts work best: "make this video anime," "change the lighting to be more dramatic." Add "keep everything else the same" when targeting a single element.',
          'zh-CN':
            '可以。将片段接入节点的视频输入并描述改动，Gemini Omni 1.1 Flash 会在保留其余部分的前提下应用该改动。简短的提示词效果最好，例如「make this video anime」「change the lighting to be more dramatic」。若只想改动单个元素，可加上「keep everything else the same」。'
        }
      },
      {
        id: 'compared-to-previous-omni-flash',
        question: {
          en: 'How does Gemini Omni 1.1 Flash compare to the previous Omni Flash?',
          'zh-CN': 'Gemini Omni 1.1 Flash 与上一代 Omni Flash 相比如何？'
        },
        answer: {
          en: 'Gemini Omni 1.1 Flash is a full replacement for earlier Omni Flash versions, with the same generate-and-edit workflow and faster generation. The 1.1 release lets you draft videos more efficiently at 360p, upscale to 4K resolution, and extend scenes for longer storytelling.',
          'zh-CN':
            'Gemini Omni 1.1 Flash 完全取代此前各版本的 Omni Flash，沿用同样的生成与编辑工作流，且生成更快。1.1 版本让你能以 360p 更高效地打草稿，放大到 4K 分辨率，并延长场景以讲述更长的故事。'
        }
      },
      {
        id: 'cost-in-comfyui',
        question: {
          en: 'How much does Gemini Omni 1.1 Flash cost in ComfyUI?',
          'zh-CN': '在 ComfyUI 中使用 Gemini Omni 1.1 Flash 的费用是多少？'
        },
        answer: {
          en: 'Gemini Omni 1.1 Flash is billed per generation through ComfyUI credits, with cost varying by resolution. See the ComfyUI pricing page for current rates. No separate Google subscription is needed.',
          'zh-CN':
            'Gemini Omni 1.1 Flash 按每次生成通过 ComfyUI 积分计费，费用随分辨率而变。当前费率请见 ComfyUI 定价页面。无需单独订阅 Google。'
        }
      }
    ]
  },
  // June's order: outputs, then how to direct, then Q&A, then pricing.
  sectionOrder: ['gallery', 'steps', 'faq', 'pricing'],
  runOptions: {
    headingKey: 'geminiOmni.runOptions.heading',
    subtitleKey: 'geminiOmni.runOptions.subtitle',
    ctaKey: 'geminiOmni.runOptions.cta'
  },
  reviews: {
    headingKey: 'geminiOmni.reviews.heading',
    highlight: {
      titleKey: 'geminiOmni.reviews.highlightTitle',
      descriptionKey: 'geminiOmni.reviews.highlightDescription',
      ctaKey: 'geminiOmni.reviews.highlightCta'
    }
  }
} satisfies ModelLaunchPage
