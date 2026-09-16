import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const qwenImage21Links = {
  cloud:
    'https://cloud.comfy.org/?template=image_qwen_image_2_1&utm_source=comfy.org&utm_medium=referral&utm_campaign=qwen-image-2-1',
  docs: 'https://docs.comfy.org/tutorials/image/qwen/qwen-image',
  hubModel: new URL('model/qwen/', externalLinks.workflows).href
} as const

const mediaBase = 'https://media.comfy.org/website/qwen-image-2.1'

const media = {
  hero: {
    kind: 'video',
    src: `${mediaBase}/hero.mp4`,
    posterSrc: `${mediaBase}/hero-poster.webp`
  },
  infographic: { kind: 'image', src: `${mediaBase}/infographic.webp` },
  stoop: { kind: 'image', src: `${mediaBase}/harlem-stoop.webp` },
  holi: { kind: 'image', src: `${mediaBase}/holi-powder.webp` },
  game: { kind: 'image', src: `${mediaBase}/game-environment.webp` },
  character: { kind: 'image', src: `${mediaBase}/character-sheet.webp` },
  interior: { kind: 'image', src: `${mediaBase}/interior-archviz.webp` }
} as const satisfies Record<string, ModelLaunchMedia>

const freeNote = { en: 'Included free', 'zh-CN': '免费包含' }

const runOptions = {
  headingKey: 'qwenImage21.runOptions.heading',
  subtitleKey: 'qwenImage21.runOptions.subtitle',
  ctaKey: 'qwenImage21.runOptions.cta'
} as const

const reviews = {
  headingKey: 'qwenImage21.reviews.heading',
  highlight: {
    titleKey: 'qwenImage21.reviews.highlightTitle',
    descriptionKey: 'qwenImage21.reviews.highlightDescription',
    ctaKey: 'qwenImage21.reviews.highlightCta'
  }
} as const

// Live until launch day; the route stubs point here. Swapping them to
// qwenImage21Page turns on the full hero, gallery, pricing and FAQ.
export const qwenImage21AnnouncementPage: ModelLaunchPage = {
  metaTitleKey: 'qwenImage21.announcement.meta.title',
  metaDescriptionKey: 'qwenImage21.announcement.meta.description',
  breadcrumbLabelKey: 'qwenImage21.breadcrumb.model',
  breadcrumbUpdatedKey: 'qwenImage21.announcement.breadcrumb.updated',
  hero: {
    layout: 'overlay',
    placeholderImageSrc: '/images/models/qwen-image-2-1-placeholder.webp',
    logoMaskImageSrc: '/images/models/qwen-image-2-1-logo-mask.webp',
    eyebrowKey: 'qwenImage21.announcement.hero.eyebrow',
    titleKey: 'qwenImage21.breadcrumb.model',
    descriptionKey: 'qwenImage21.announcement.hero.description',
    primaryCta: {
      labelKey: 'qwenImage21.announcement.hero.primaryCta',
      href: externalLinks.cloudCta('qwen_image_2_1_announcement'),
      target: '_blank'
    },
    badgeKeys: [
      'qwenImage21.hero.tagOpenSource',
      'qwenImage21.hero.tagTextToImage',
      'qwenImage21.hero.tagImageEditing'
    ]
  },
  runOptions,
  reviews
}

export const qwenImage21Page: ModelLaunchPage = {
  metaTitleKey: 'qwenImage21.meta.title',
  metaDescriptionKey: 'qwenImage21.meta.description',
  breadcrumbLabelKey: 'qwenImage21.breadcrumb.model',
  breadcrumbUpdatedKey: 'qwenImage21.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    mobileFallbackImageSrc: media.hero.posterSrc,
    mobileVideoSrc: `${mediaBase}/hero-mobile.mp4`,
    logoSrc: '/icons/ai-models/qwen.svg',
    titleKey: 'qwenImage21.hero.title',
    descriptionKey: 'qwenImage21.hero.description',
    badgeKeys: [
      'qwenImage21.hero.tagOpenSource',
      'qwenImage21.hero.tagTextToImage',
      'qwenImage21.hero.tagImageEditing'
    ],
    primaryCta: {
      labelKey: 'qwenImage21.hero.primaryCta',
      href: qwenImage21Links.cloud,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'qwenImage21.hero.secondaryCta',
      href: qwenImage21Links.docs,
      target: '_blank'
    }
  },
  gallery: {
    headingKey: 'qwenImage21.gallery.heading',
    ctaVariant: 'accent',
    cards: [
      {
        id: 'infographic',
        name: {
          en: 'Coffee infographic generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的咖啡信息图'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A five-step "From Cherry to Cup" explainer with every heading, number, and label set cleanly in one pass.',
          'zh-CN':
            '五步"从咖啡果到咖啡杯"说明图，标题、编号与标签一次生成即工整清晰。'
        },
        media: media.infographic,
        href: qwenImage21Links.cloud
      },
      {
        id: 'harlem-stoop',
        name: {
          en: 'Editorial portrait on a Harlem stoop generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的哈莱姆门廊人像'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Denim on denim, wrought iron, and warm brick: a natural portrait with true skin tones and fabric detail.',
          'zh-CN':
            '牛仔套装、铸铁栏杆与暖色砖墙：肤色真实、布料细节丰富的自然人像。'
        },
        media: media.stoop,
        href: qwenImage21Links.cloud
      },
      {
        id: 'holi-powder',
        name: {
          en: 'Holi colour powder burst generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的洒红节彩粉'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Magenta, gold, and cobalt powder frozen mid-air against clean white, every grain sharp.',
          'zh-CN':
            '洋红、金黄与钴蓝彩粉在纯白背景前凝固半空，每一粒都清晰锐利。'
        },
        media: media.holi,
        href: qwenImage21Links.cloud
      },
      {
        id: 'game-environment',
        name: {
          en: 'Floating island game environment generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的浮空岛游戏场景'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A waterfall citadel and rope bridges in a painterly concept-art style, ready for a level brief.',
          'zh-CN': '瀑布城堡与绳桥构成的绘画风概念场景，可直接用于关卡设定。'
        },
        media: media.game,
        href: qwenImage21Links.cloud
      },
      {
        id: 'character-sheet',
        name: {
          en: 'Character turnaround sheet generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的角色三视图'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Four consistent views of the same character, from goggles to boots, on a clean white sheet.',
          'zh-CN':
            '同一角色四个视角保持一致，从护目镜到靴子，呈现在干净的白底上。'
        },
        media: media.character,
        href: qwenImage21Links.cloud
      },
      {
        id: 'interior-archviz',
        name: {
          en: 'Interior architectural visualization generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的室内建筑可视化'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A calm living room in soft daylight: oak, linen, paper lantern, and birch forest beyond the glass.',
          'zh-CN':
            '柔和日光中的静谧客厅：橡木、亚麻、纸灯笼，以及窗外的白桦林。'
        },
        media: media.interior,
        href: qwenImage21Links.cloud
      }
    ]
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'qwenImage21.pricing.banner.title',
      subtitleKey: 'qwenImage21.pricing.banner.subtitle',
      cta: {
        labelKey: 'qwenImage21.pricing.banner.cta',
        href: qwenImage21Links.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'qwenImage21.faq.heading',
    items: [
      {
        id: 'what-is-qwen-image-2-1',
        question: {
          en: 'What is Qwen Image 2.1?',
          'zh-CN': 'Qwen Image 2.1 是什么？'
        },
        answer: {
          en: 'Qwen Image 2.1 is the latest image model from the Qwen team at Alibaba. One model handles both text-to-image generation and instruction-based editing, with a focus on accurate text rendering and native high-resolution output. It runs natively in ComfyUI.',
          'zh-CN':
            'Qwen Image 2.1 是阿里巴巴 Qwen 团队推出的最新图像模型。同一模型同时支持文生图与基于指令的图像编辑，专注于精准的文字渲染和原生高分辨率输出。它可在 ComfyUI 中原生运行。'
        }
      },
      {
        id: 'how-to-run',
        question: {
          en: 'How do I run Qwen Image 2.1 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 Qwen Image 2.1？'
        },
        answer: {
          en: `Open the template on [Comfy Cloud](${qwenImage21Links.cloud}) and press run, or download the weights and load the same workflow in ComfyUI on your own GPU. The [guide](${qwenImage21Links.docs}) lists the model files and where they go.`,
          'zh-CN': `在 [Comfy Cloud](${qwenImage21Links.cloud}) 打开模板并运行，或下载权重后在自己的 GPU 上用 ComfyUI 加载同一工作流。[教程](${qwenImage21Links.docs}) 列出了所需模型文件及存放位置。`
        }
      },
      {
        id: 'text-rendering',
        question: {
          en: 'How well does Qwen Image 2.1 render text?',
          'zh-CN': 'Qwen Image 2.1 的文字渲染效果如何？'
        },
        answer: {
          en: "Text rendering is the model's signature strength. Posters, infographics, slides, comics, and signage come out with legible copy in both English and Chinese, so you can put the exact words you need into the prompt rather than compositing them afterwards.",
          'zh-CN':
            '文字渲染是该模型的招牌能力。海报、信息图、幻灯片、漫画和招牌中的中英文文字都能清晰生成，你可以直接把需要的文字写进提示词，而无需事后合成。'
        }
      },
      {
        id: 'image-editing',
        question: {
          en: 'Can Qwen Image 2.1 edit an existing image?',
          'zh-CN': 'Qwen Image 2.1 可以编辑现有图像吗？'
        },
        answer: {
          en: 'Yes. Feed in an image and describe the change: swap objects, restyle a scene, relight it, or revise the text it contains. Generation and editing live in the same model, so no second checkpoint is needed.',
          'zh-CN':
            '可以。输入图像并描述改动：替换物体、重塑场景风格、重新打光或修改图中文字。生成与编辑集成在同一模型中，无需加载第二个模型。'
        }
      },
      {
        id: 'license',
        question: {
          en: 'Can I use Qwen Image 2.1 commercially?',
          'zh-CN': 'Qwen Image 2.1 可以商用吗？'
        },
        answer: {
          en: 'Qwen Image 2.1 ships as open weights under the Apache 2.0 license, so you can run it locally, fine-tune it, and use the output in commercial work. On Comfy Cloud it is included in your plan with no per-image fee.',
          'zh-CN':
            'Qwen Image 2.1 以 Apache 2.0 许可开源权重发布，你可以本地运行、微调，并将输出用于商业项目。在 Comfy Cloud 上它包含在套餐内，无需按张付费。'
        }
      },
      {
        id: 'comfy-workflows',
        question: {
          en: 'Why use Qwen Image 2.1 in a ComfyUI workflow?',
          'zh-CN': '为什么要在 ComfyUI 工作流中使用 Qwen Image 2.1？'
        },
        answer: {
          en: 'The generated image becomes one step in a larger, repeatable pipeline. Add ControlNet or LoRAs, route the result into upscaling, animation, or another model, and keep every step visible and adjustable.',
          'zh-CN':
            '生成的图像可以成为更大规模、可复用流程中的一步。你可以加入 ControlNet 或 LoRA，将结果继续传入放大、动画或其他模型，同时让每个步骤都保持可见、可调。'
        }
      }
    ]
  },
  runOptions,
  reviews
}
