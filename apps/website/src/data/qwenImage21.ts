import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

const qwenImage21Links = {
  cloud:
    'https://cloud.comfy.org/?template=image_qwen_image_2_1_t2i&utm_source=comfy.org&utm_medium=referral&utm_campaign=qwen-image-2-1',
  cloudEdit:
    'https://cloud.comfy.org/?template=image_qwen_image_2_1_image_edit&utm_source=comfy.org&utm_medium=referral&utm_campaign=qwen-image-2-1',
  docs: 'https://docs.comfy.org/tutorials/image/qwen/qwen-image',
  hubModel: new URL('model/qwen/', externalLinks.workflows).href,
  license: 'https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE'
} as const

const mediaBase = 'https://media.comfy.org/website/qwen-image-2.1'

const media = {
  hero: {
    kind: 'video',
    src: `${mediaBase}/hero-sizzle-v2.mp4`,
    posterSrc: `${mediaBase}/hero-poster-v2.webp`
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
      'qwenImage21.hero.tagOpenWeights',
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
    mobileVideoSrc: `${mediaBase}/hero-sizzle-v2-mobile.mp4`,
    logoSrc: '/icons/ai-models/qwen.svg',
    titleKey: 'qwenImage21.hero.title',
    descriptionKey: 'qwenImage21.hero.description',
    badgeKeys: [
      'qwenImage21.hero.tagOpenWeights',
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
          en: 'Coffee infographic generated with Qwen-Image 2.1',
          'zh-CN': '使用 Qwen-Image 2.1 生成的咖啡信息图'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A five-step "From Cherry to Cup" explainer with every heading, number, and label set cleanly in one pass.',
          'zh-CN':
            '五步"从咖啡果到咖啡杯"说明图，标题、编号与标签一次生成即工整清晰。'
        },
        prompt: {
          en: 'Clean flat vector infographic titled "FROM CHERRY TO CUP" showing five numbered steps left to right with an icon and one-word label each: 1 Harvest, 2 Process, 3 Roast, 4 Grind, 5 Brew. Earthy palette, generous white space, labels legible.',
          'zh-CN':
            '简洁扁平矢量信息图，标题为 "FROM CHERRY TO CUP"，从左到右展示五个带编号的步骤，每步配一个图标和一个单词标签：1 Harvest、2 Process、3 Roast、4 Grind、5 Brew。大地色调，留白充足，标签清晰可读。'
        },
        media: media.infographic,
        href: qwenImage21Links.cloud
      },
      {
        id: 'harlem-stoop',
        name: {
          en: 'Editorial portrait on a Harlem stoop generated with Qwen-Image 2.1',
          'zh-CN': '使用 Qwen-Image 2.1 生成的哈莱姆门廊人像'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Denim on denim, wrought iron, and warm brick: a natural portrait with true skin tones and fabric detail.',
          'zh-CN':
            '牛仔套装、铸铁栏杆与暖色砖墙：肤色真实、布料细节丰富的自然人像。'
        },
        prompt: {
          en: 'Denim-on-denim street portrait on a Harlem brownstone stoop. Subject seated on the steps, elbows on knees, gold rings, golden hour sun flaring off the wrought iron, warm brick background falling soft, 85mm at f/1.8.',
          'zh-CN':
            '哈莱姆褐石公寓门廊上的牛仔套装街头人像。人物坐在台阶上，手肘搭在膝盖，戴金戒指，黄昏阳光在铸铁栏杆上泛起眩光，暖色砖墙背景柔和虚化，85mm f/1.8。'
        },
        media: media.stoop,
        href: qwenImage21Links.cloud
      },
      {
        id: 'holi-powder',
        name: {
          en: 'Holi colour powder burst generated with Qwen-Image 2.1',
          'zh-CN': '使用 Qwen-Image 2.1 生成的洒红节彩粉'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Magenta, gold, and cobalt powder frozen mid-air against clean white, every grain sharp.',
          'zh-CN':
            '洋红、金黄与钴蓝彩粉在纯白背景前凝固半空，每一粒都清晰锐利。'
        },
        prompt: {
          en: 'Burst of holi powder caught at the moment of impact. Magenta, chrome yellow and ultramarine clouds blooming against a white sky, silhouetted arms at the frame edge, 1/8000s freeze, every grain separated.',
          'zh-CN':
            '洒红节彩粉在撞击瞬间迸发。洋红、铬黄与群青的粉云在白色天空前绽开，画面边缘是手臂剪影，1/8000 秒定格，每一粒粉末都清晰可辨。'
        },
        media: media.holi,
        href: qwenImage21Links.cloud
      },
      {
        id: 'game-environment',
        name: {
          en: 'Floating island game environment generated with Qwen-Image 2.1',
          'zh-CN': '使用 Qwen-Image 2.1 生成的浮空岛游戏场景'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A waterfall citadel and rope bridges in a painterly concept-art style, ready for a level brief.',
          'zh-CN': '瀑布城堡与绳桥构成的绘画风概念场景，可直接用于关卡设定。'
        },
        prompt: {
          en: 'Game environment concept art: a floating temple city built into giant waterfalls, rope bridges between stone platforms, glowing moss, tiny figures for scale, atmospheric perspective, painterly matte painting.',
          'zh-CN':
            '游戏场景概念图：建在巨型瀑布之中的浮空神庙之城，石台之间以绳桥相连，发光的苔藓，用微小人物体现比例，大气透视，绘画感的接景画。'
        },
        media: media.game,
        href: qwenImage21Links.cloud
      },
      {
        id: 'character-sheet',
        name: {
          en: 'Character turnaround sheet generated with Qwen-Image 2.1',
          'zh-CN': '使用 Qwen-Image 2.1 生成的角色三视图'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'Four consistent views of the same character, from goggles to boots, on a clean white sheet.',
          'zh-CN':
            '同一角色四个视角保持一致，从护目镜到靴子，呈现在干净的白底上。'
        },
        prompt: {
          en: 'Character turnaround sheet for an animated film: a young inventor girl with goggles on her head, patched overalls and a mechanical arm, shown in front, three-quarter, side and back views side by side on a plain background, consistent proportions and colours across all views.',
          'zh-CN':
            '动画电影角色三视图：头戴护目镜、身穿补丁背带裤、装有机械臂的年轻发明家女孩，在素色背景上并排展示正面、四分之三侧面、侧面与背面视角，各视角比例与配色保持一致。'
        },
        media: media.character,
        href: qwenImage21Links.cloud
      },
      {
        id: 'interior-archviz',
        name: {
          en: 'Interior architectural visualization generated with Qwen-Image 2.1',
          'zh-CN': '使用 Qwen-Image 2.1 生成的室内建筑可视化'
        },
        tier: 'free',
        note: freeNote,
        description: {
          en: 'A calm living room in soft daylight: oak, linen, paper lantern, and birch forest beyond the glass.',
          'zh-CN':
            '柔和日光中的静谧客厅：橡木、亚麻、纸灯笼，以及窗外的白桦林。'
        },
        prompt: {
          en: 'Architectural interior photograph of a Japandi living room: low oak sofa, paper floor lamp, limewashed walls, a large window onto a bamboo garden, a side table with a ceramic vase, late morning light, two-point perspective with vertical lines kept straight.',
          'zh-CN':
            '日式北欧风客厅的建筑室内摄影：低矮橡木沙发、纸质落地灯、石灰涂料墙面、面向竹园的大窗、放着陶瓷花瓶的边几，上午晚些时候的光线，两点透视且垂直线保持竖直。'
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
          en: 'What is Qwen-Image 2.1?',
          'zh-CN': 'Qwen-Image 2.1 是什么？'
        },
        answer: {
          en: "Qwen-Image 2.1 is an open-weight image model from Alibaba's Qwen team. It runs 7B parameters on an optimized MMDiT architecture, outputs RGBA images with a real alpha channel, generates at native 2K, and handles both generation and editing in a single checkpoint.",
          'zh-CN':
            'Qwen-Image 2.1 是阿里巴巴 Qwen 团队推出的开源权重图像模型。它基于优化的 MMDiT 架构、拥有 7B 参数，可输出带真实 Alpha 通道的 RGBA 图像，原生生成 2K 分辨率，并在同一个模型中同时完成生成与编辑。'
        }
      },
      {
        id: 'how-to-use',
        question: {
          en: 'How do I use Qwen-Image 2.1 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中使用 Qwen-Image 2.1？'
        },
        answer: {
          en: `Update ComfyUI to the latest version and download the Qwen-Image 2.1 weights from Hugging Face into your models folder. Add the Text Encode Qwen Image 2.1 node, found under model/conditioning/qwen image, or load the [Qwen-Image 2.1 template](${qwenImage21Links.cloud}). Comfy Cloud runs the same workflow without a local download.`,
          'zh-CN': `将 ComfyUI 更新到最新版本，并从 Hugging Face 下载 Qwen-Image 2.1 权重放入 models 文件夹。添加位于 model/conditioning/qwen image 下的 Text Encode Qwen Image 2.1 节点，或直接加载 [Qwen-Image 2.1 模板](${qwenImage21Links.cloud})。Comfy Cloud 无需本地下载即可运行同一工作流。`
        }
      },
      {
        id: 'cost',
        question: {
          en: 'How much does Qwen-Image 2.1 cost in ComfyUI?',
          'zh-CN': '在 ComfyUI 中使用 Qwen-Image 2.1 需要多少费用？'
        },
        answer: {
          en: `Qwen-Image 2.1 is open weights, so running it locally in ComfyUI costs nothing per image beyond your own hardware. On Comfy Cloud it draws on your plan's compute — see the [ComfyUI pricing page](${externalLinks.pricing}) for current rates.`,
          'zh-CN': `Qwen-Image 2.1 是开源权重模型，在 ComfyUI 本地运行除自有硬件外无需按张付费。在 Comfy Cloud 上则消耗套餐内的算力，当前费率请参阅 [ComfyUI 定价页面](${externalLinks.pricing})。`
        }
      },
      {
        id: 'commercial-use',
        question: {
          en: 'Can I use Qwen-Image 2.1 commercially?',
          'zh-CN': '我可以将 Qwen-Image 2.1 用于商业用途吗？'
        },
        answer: {
          en: `No. Qwen-Image 2.1 is released under the [Qwen Research License Agreement](${qwenImage21Links.license}), which grants a royalty-free license "FOR NON-COMMERCIAL PURPOSES ONLY" and directs commercial licensing inquiries to the model maker. The license also requires products built with the model to display "Built with Qwen" in their documentation. Check the license yourself before using output in any commercial work.`,
          'zh-CN': `不可以。Qwen-Image 2.1 依据 [Qwen Research License Agreement](${qwenImage21Links.license})（Qwen 研究许可协议）发布，该协议授予的免版税许可"仅限非商业用途"（FOR NON-COMMERCIAL PURPOSES ONLY），并要求商业授权咨询联系模型开发方。该协议还要求基于该模型构建的产品在其文档中注明"Built with Qwen"。在将输出用于任何商业工作之前，请自行查阅许可协议。`
        }
      },
      {
        id: 'transparency',
        question: {
          en: 'Can Qwen-Image 2.1 generate transparent images?',
          'zh-CN': 'Qwen-Image 2.1 可以生成透明图像吗？'
        },
        answer: {
          en: 'Yes. Qwen-Image 2.1 outputs four-channel RGBA, so transparency comes out of the model itself rather than a background-removal pass. Sprites, logos, icons, and product cutouts land with alpha already correct, ready to composite. On the input side, the Text Encode Qwen Image 2.1 node passes full RGBA to the VAE and composites alpha over white for the vision tower.',
          'zh-CN':
            '可以。Qwen-Image 2.1 直接输出四通道 RGBA，透明度由模型本身生成，而非事后抠图。精灵图、Logo、图标和产品抠像生成时 Alpha 通道即已正确，可直接合成。在输入端，Text Encode Qwen Image 2.1 节点将完整 RGBA 传给 VAE，并在白色背景上合成 Alpha 供视觉编码器使用。'
        }
      },
      {
        id: 'resolution',
        question: {
          en: 'What resolution does Qwen-Image 2.1 output?',
          'zh-CN': 'Qwen-Image 2.1 输出的分辨率是多少？'
        },
        answer: {
          en: "Qwen-Image 2.1 generates natively at 2K — 2048×2048 direct output, not upscaled from a smaller render. For edits, the node's resolution setting controls the size reference images are resized to: it defaults to 1024, accepts up to 4096 in steps of 32, and 0 keeps each reference at its own size.",
          'zh-CN':
            'Qwen-Image 2.1 原生生成 2K 分辨率——直接输出 2048×2048，而非从小图放大。编辑时，节点的分辨率设置控制参考图像被缩放到的尺寸：默认 1024，最高可达 4096（步长 32），设为 0 则保持每张参考图的原始尺寸。'
        }
      },
      {
        id: 'reference-images',
        question: {
          en: 'How many reference images can Qwen-Image 2.1 take?',
          'zh-CN': 'Qwen-Image 2.1 最多可以使用多少张参考图？'
        },
        answer: {
          en: `The Text Encode Qwen Image 2.1 node opens image inputs as you fill them, up to 16. Each one is read by the text encoder and spliced into the sequence as a VAE latent, so a character, a product, a background plate, and a style reference can all drive a single edit. Start from the [image-edit template](${qwenImage21Links.cloudEdit}) on Comfy Cloud.`,
          'zh-CN': `Text Encode Qwen Image 2.1 节点会随着你填入图像而依次展开输入口，最多 16 张。每张图都由文本编码器读取，并以 VAE 潜变量的形式拼入序列，因此角色、产品、背景板和风格参考可以共同驱动一次编辑。可从 Comfy Cloud 上的[图像编辑模板](${qwenImage21Links.cloudEdit})开始。`
        }
      },
      {
        id: 'shifted-edit',
        question: {
          en: 'Why does my Qwen-Image 2.1 edit come out shifted?',
          'zh-CN': '为什么我的 Qwen-Image 2.1 编辑结果发生了偏移？'
        },
        answer: {
          en: 'Use the latent output on the Text Encode Qwen Image 2.1 node rather than an empty latent of your own. That output is sized to the first reference image, and sampling at any other size shifts the edit.',
          'zh-CN':
            '请使用 Text Encode Qwen Image 2.1 节点自带的潜变量输出，而不是自建的空潜变量。该输出的尺寸与第一张参考图一致，以其他尺寸采样会导致编辑结果偏移。'
        }
      },
      {
        id: 'less-memory',
        question: {
          en: 'How do I run Qwen-Image 2.1 with less memory?',
          'zh-CN': '如何以更少的显存运行 Qwen-Image 2.1？'
        },
        answer: {
          en: 'At 7B parameters Qwen-Image 2.1 is built for consumer GPUs, and the experimental Qwen Image 2.1 Cache node tunes it further. Set the KV cache to auto, gpu, cpu, or off, and pick a storage precision: int8 halves the cache at about bf16 accuracy, int4 quarters it but roughly doubles per-step error.',
          'zh-CN':
            'Qwen-Image 2.1 仅 7B 参数，本就面向消费级 GPU 设计，实验性的 Qwen Image 2.1 Cache 节点还能进一步调优。可将 KV 缓存设为 auto、gpu、cpu 或 off，并选择存储精度：int8 将缓存减半且精度接近 bf16，int4 减至四分之一但每步误差大约翻倍。'
        }
      }
    ]
  },
  runOptions,
  reviews
}
