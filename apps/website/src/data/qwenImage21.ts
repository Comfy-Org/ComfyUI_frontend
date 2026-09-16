import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const qwenImage21Links = {
  cloud:
    'https://cloud.comfy.org/?template=image_qwen_image_2_1&utm_source=comfy.org&utm_medium=referral&utm_campaign=qwen-image-2-1',
  docs: 'https://docs.comfy.org/tutorials/image/qwen/qwen-image-2-1',
  hubModel: new URL('model/qwen/', externalLinks.workflows).href
} as const

const mediaBase = 'https://media.comfy.org/website/qwen-image-2.1'

const media = {
  hero: {
    kind: 'video',
    src: `${mediaBase}/hero.mp4`,
    posterSrc: `${mediaBase}/hero-poster.webp`
  },
  poster: { kind: 'image', src: `${mediaBase}/typographic-poster.webp` },
  infographic: { kind: 'image', src: `${mediaBase}/infographic.webp` },
  portrait: { kind: 'image', src: `${mediaBase}/studio-portrait.webp` },
  storefront: { kind: 'image', src: `${mediaBase}/night-storefront.webp` },
  comic: { kind: 'image', src: `${mediaBase}/comic-page.webp` },
  interior: { kind: 'image', src: `${mediaBase}/interior-relight.webp` }
} as const satisfies Record<string, ModelLaunchMedia>

const freeNote = { en: 'Included free', 'zh-CN': '免费包含' }

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
        id: 'typographic-poster',
        name: {
          en: 'Typographic concert poster generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的文字排版演出海报'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A layered gig poster with every line of copy rendered legibly in a single pass.',
          'zh-CN': '层次丰富的演出海报，所有文案一次生成即清晰可读。'
        },
        media: media.poster,
        href: qwenImage21Links.cloud
      },
      {
        id: 'infographic',
        name: {
          en: 'Product infographic generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的产品信息图'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A four-panel explainer laid out from a long brief: headings, callouts, and icons in place.',
          'zh-CN': '根据长篇简报排版的四格说明图，标题、标注与图标各就各位。'
        },
        media: media.infographic,
        href: qwenImage21Links.cloud
      },
      {
        id: 'studio-portrait',
        name: {
          en: 'Studio portrait generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的棚拍人像'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A natural 2K portrait with soft key light, true skin tones, and fine fabric detail.',
          'zh-CN': '自然的 2K 人像，柔和主光、真实肤色与细腻布料质感。'
        },
        media: media.portrait,
        href: qwenImage21Links.cloud
      },
      {
        id: 'night-storefront',
        name: {
          en: 'Neon storefront at night generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的夜间霓虹店面'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Rain-slick street, bilingual neon signage, and reflections that hold up at full resolution.',
          'zh-CN':
            '雨后街道、中英双语霓虹招牌，全分辨率下依然经得起细看的倒影。'
        },
        media: media.storefront,
        href: qwenImage21Links.cloud
      },
      {
        id: 'comic-page',
        name: {
          en: 'Comic page generated with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 生成的漫画页'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A six-panel page with consistent characters and dialogue set cleanly inside each balloon.',
          'zh-CN': '六格漫画页，角色前后一致，对白工整地排在每个气泡里。'
        },
        media: media.comic,
        href: qwenImage21Links.cloud
      },
      {
        id: 'interior-relight',
        name: {
          en: 'Relit interior edited with Qwen Image 2.1',
          'zh-CN': '使用 Qwen Image 2.1 重新打光的室内场景'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'The same living room moved from midday to golden hour with one edit instruction.',
          'zh-CN': '一句编辑指令，把同一间客厅从正午带到黄昏。'
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
  runOptions: {
    headingKey: 'qwenImage21.runOptions.heading',
    subtitleKey: 'qwenImage21.runOptions.subtitle',
    ctaKey: 'qwenImage21.runOptions.cta'
  },
  reviews: {
    headingKey: 'qwenImage21.reviews.heading',
    highlight: {
      titleKey: 'qwenImage21.reviews.highlightTitle',
      descriptionKey: 'qwenImage21.reviews.highlightDescription',
      ctaKey: 'qwenImage21.reviews.highlightCta'
    }
  }
}
