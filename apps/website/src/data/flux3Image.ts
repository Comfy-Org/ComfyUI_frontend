import type { ModelLaunchPage } from '@/templates/model-launch/types'

import { externalLinks } from '@/config/routes'

import { qwenImage21Page } from './qwenImage21'

const bflLicensing = 'https://bfl.ai/licensing'

const cloudTemplate = 'https://cloud.comfy.org/?template=image_flux3_klein_t2i'

const mediaBase = 'https://media.comfy.org/website/flux-3-image'

const sampleCard = {
  tier: 'free',
  href: cloudTemplate
} as const

export const flux3ImagePage: ModelLaunchPage = {
  ...qwenImage21Page,
  metaTitleKey: 'flux3Image.meta.title',
  metaDescriptionKey: 'flux3Image.hero.description',
  breadcrumbLabelKey: 'flux3Image.hero.title',
  breadcrumbUpdatedKey: 'flux3Image.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    videoSrc: `${mediaBase}/flux-hero-1280.mp4`,
    posterSrc: `${mediaBase}/flux-hero-poster.jpg`,
    mobileFallbackImageSrc: `${mediaBase}/flux-hero-poster.jpg`,
    titleKey: 'flux3Image.hero.title',
    descriptionKey: 'flux3Image.hero.description',
    badgeKeys: [
      'flux3Image.hero.openSource',
      'flux3Image.hero.imageGeneration',
      'flux3Image.hero.imageEdit'
    ],
    primaryCta: {
      labelKey: 'flux3Image.hero.primaryCta',
      href: cloudTemplate,
      target: '_blank'
    }
  },
  gallery: {
    ctaVariant: 'accent',
    cards: [
      {
        ...sampleCard,
        id: 'lynx',
        name: {
          en: 'Lynx in a snowy forest generated with FLUX 3 Image Klein',
          'zh-CN': '使用 FLUX 3 Image Klein 生成的雪林猞猁'
        },
        description: {
          en: 'A lynx half-hidden behind a snowy spruce, with amber eyes, ear tufts and falling snow held in sharp focus.',
          'zh-CN':
            '猞猁半藏在积雪云杉后，琥珀色的眼睛、耳尖簇毛与飘落的雪花都清晰锐利。'
        },
        prompt: {
          en: 'Wildlife photograph of a Eurasian lynx peering out from behind the trunk of a large spruce in a snowy Black Forest. Only its head, black ear tufts, facial ruff and one front paw are visible, and its amber eyes look directly into the camera. Light snow falling, soft overcast light, snow-covered branches framing the edges. Eye-level, 500mm lens, f/5.6, shallow depth of field.',
          'zh-CN':
            '野生动物摄影：一只欧亚猞猁从积雪覆盖的黑森林中一棵大云杉的树干后探出头来。只露出头部、黑色耳尖簇毛、面部颈毛和一只前爪，琥珀色的眼睛直视镜头。小雪飘落，阴天柔光，积雪的枝条框住画面边缘。平视角度，500mm 镜头，f/5.6，浅景深。'
        },
        media: { kind: 'image', src: `${mediaBase}/lynx-snow-forest.webp` }
      },
      {
        ...sampleCard,
        id: 'carousel',
        name: {
          en: 'Zoom-burst carousel at night generated with FLUX 3 Image Klein',
          'zh-CN': '使用 FLUX 3 Image Klein 生成的夜间旋转木马变焦爆炸照'
        },
        description: {
          en: 'A zoom-burst exposure streaks thousands of bulbs into gold and magenta while the carousel horse stays sharp.',
          'zh-CN':
            '变焦爆炸曝光将成千上万的灯泡拉成金色与洋红光轨，旋转木马却依然清晰。'
        },
        prompt: {
          en: 'Zoom-burst photograph of an illuminated carousel at a night fair: the lens zoomed during a one-second exposure stretches the thousands of bulbs into radial streaks of gold and magenta bursting outward, while a painted carousel horse at the center stays sharp. Deep black sky, vibrant and kinetic.',
          'zh-CN':
            '夜间游乐场中灯火通明的旋转木马的变焦爆炸摄影：在一秒曝光期间推拉变焦，将成千上万的灯泡拉伸成向外迸射的金色与洋红色放射状光轨，而画面中央一匹彩绘木马保持清晰。深黑色夜空，鲜艳而富有动感。'
        },
        media: { kind: 'image', src: `${mediaBase}/carousel-zoom-burst.webp` }
      },
      {
        ...sampleCard,
        id: 'hanoi-sketch',
        name: {
          en: 'Hanoi street urban sketch generated with FLUX 3 Image Klein',
          'zh-CN': '使用 FLUX 3 Image Klein 生成的河内街头速写'
        },
        description: {
          en: 'Loose ink lines and bleeding watercolor capture a busy Hanoi street of tangled cables, food stalls and motorbikes.',
          'zh-CN':
            '随性的墨线与晕染的水彩，描绘电线交错、小摊林立、摩托穿行的河内街头。'
        },
        prompt: {
          en: 'Urban sketch in fountain-pen ink and loose watercolor: a busy Hanoi street corner with tangled overhead cables, narrow shophouses, a street-food stall with low plastic stools and a stream of motorbikes. Quick confident ink lines, wet-in-wet washes bleeding past the lines, splashes of color, and edges that fade into bare white paper.',
          'zh-CN':
            '钢笔墨水与随性水彩的城市速写：繁忙的河内街角，头顶电线缠绕交错，狭窄的骑楼商铺，摆着低矮塑料凳的街边小吃摊，以及川流不息的摩托车。迅速而自信的墨线，湿画法的水彩晕染溢出线条，点点色彩飞溅，边缘渐隐于留白的纸面。'
        },
        media: { kind: 'image', src: `${mediaBase}/hanoi-urban-sketch.webp` }
      },
      {
        ...sampleCard,
        id: 'madhubani-tree',
        name: {
          en: 'Madhubani tree of life painting generated with FLUX 3 Image Klein',
          'zh-CN': '使用 FLUX 3 Image Klein 生成的马图巴尼生命之树画作'
        },
        description: {
          en: 'A Madhubani tree of life with peacocks and fish, every shape double-outlined and filled with fine pattern.',
          'zh-CN':
            '孔雀栖枝、鱼游池中的马图巴尼生命之树，每个形状都以双线勾勒并填满细密纹样。'
        },
        prompt: {
          en: 'Madhubani folk painting of a tree of life with peacocks perched in its branches and fish swimming in a pond at its roots. Every shape is outlined with bold double lines and filled with fine hatching, dots and repeating patterns, with no empty space. Natural pigments of turmeric yellow, indigo, red ochre and leaf green on handmade paper with a decorative geometric border.',
          'zh-CN':
            '马图巴尼民间绘画：一棵生命之树，枝头栖息着孔雀，树根处的池塘里有鱼游动。每个形状都以粗重的双线勾勒，并填满细密的排线、圆点和重复图案，不留任何空白。在手工纸上使用姜黄、靛蓝、红赭和叶绿等天然颜料，并配有装饰性的几何边框。'
        },
        media: {
          kind: 'image',
          src: `${mediaBase}/madhubani-tree-of-life.webp`
        }
      },
      {
        ...sampleCard,
        id: 'yohaku-poster',
        name: {
          en: 'Minimalist Japanese "余白" poster generated with FLUX 3 Image Klein',
          'zh-CN': '使用 FLUX 3 Image Klein 生成的极简日式"余白"海报'
        },
        description: {
          en: 'Crisp vertical Mincho type, a single vermilion dot and calm negative space in a minimalist Japanese poster.',
          'zh-CN':
            '清晰的竖排明朝体文字、一枚朱红圆点与宁静的留白，构成极简日式海报。'
        },
        prompt: {
          en: 'Minimalist Japanese poster with vast negative space on warm off-white paper: a single small vermilion circle placed off-center, and the two characters "余白" set vertically in a fine black Mincho typeface far from it, with a tiny line of English beneath reading "EMPTY SPACE". Flat silkscreen ink, subtle paper texture, calm and precise.',
          'zh-CN':
            '极简日式海报，在暖调米白纸张上留出大片负空间：一个小小的朱红圆点偏离中心放置，远处以纤细的黑色明朝体竖排两个字"余白"，其下方有一行极小的英文 "EMPTY SPACE"。平涂丝网印刷油墨，细微的纸张纹理，宁静而精准。'
        },
        media: { kind: 'image', src: `${mediaBase}/yohaku-poster.webp` }
      },
      {
        ...sampleCard,
        id: 'albatross-mascot',
        name: {
          en: 'Albatross mascot in a VR headset generated with FLUX 3 Image Klein',
          'zh-CN': '使用 FLUX 3 Image Klein 生成的戴 VR 头显的信天翁吉祥物'
        },
        description: {
          en: 'An albatross in a brushed-silver VR headset skims Titisee lake, its wingtips almost touching its reflection.',
          'zh-CN':
            '戴着拉丝银色 VR 头显的信天翁掠过蒂蒂湖，翼尖几乎触到水中倒影。'
        },
        prompt: {
          en: 'Action photograph of a sleek albatross with a snow-white head and body, long dark-grey wings and a large pale-pink hooked beak, wearing a minimalist brushed-silver VR headset with a dark smoked-glass visor that covers its eyes; the beak sticks out below the lower edge of the visor. It glides low over the calm surface of Titisee lake from left to right, its long narrow wings fully spread, the wingtips almost touching the water. Sunlight glints off the brushed-silver headset, and its reflection stretches across the water below. Behind it, a forested shoreline with a few wooden boathouses. Clear late-afternoon light, panning shot at 1/1000s, 300mm lens.',
          'zh-CN':
            '动作摄影：一只体态流畅的信天翁，头部和身体雪白，双翼修长呈深灰色，长着淡粉色的大钩喙，戴着一副极简的拉丝银色 VR 头显，深色烟熏玻璃面罩遮住双眼，喙从面罩下缘伸出。它从左向右低空滑过蒂蒂湖平静的湖面，修长狭窄的双翼完全展开，翼尖几乎触及水面。阳光在拉丝银色头显上闪烁，它的倒影在下方水面上延展。背景是林木茂密的湖岸和几座木制船屋。晴朗的午后晚些时候的光线，以 1/1000 秒追焦拍摄，300mm 镜头。'
        },
        media: { kind: 'image', src: `${mediaBase}/albatross-vr-mascot.webp` }
      }
    ]
  },
  pricing: {
    ...qwenImage21Page.pricing,
    banner: {
      titleKey: 'qwenImage21.pricing.banner.title',
      subtitleKey: 'qwenImage21.pricing.banner.subtitle',
      cta: {
        labelKey: 'qwenImage21.pricing.banner.cta',
        href: cloudTemplate,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'qwenImage21.faq.heading',
    items: [
      {
        id: 'overview',
        question: {
          en: 'What is FLUX 3 Image Klein?',
          'zh-CN': '什么是 FLUX 3 Image Klein？'
        },
        answer: {
          en: 'FLUX 3 Image Klein is the compact, open-weights image model in Black Forest Labs’ FLUX 3 family. It has 5.6B parameters, runs on a single consumer GPU, and handles text-to-image generation and image editing in one model. It generates natively at 4K and supports bounding box layout control and multiple reference images.',
          'zh-CN':
            'FLUX 3 Image Klein 是 Black Forest Labs 旗下 FLUX 3 系列中的紧凑型开放权重图像模型。它拥有 5.6B 参数，可在单张消费级 GPU 上运行，在同一个模型中同时支持文生图与图像编辑。它可原生生成 4K 图像，并支持边界框布局控制与多张参考图像。'
        }
      },
      {
        id: 'setup',
        question: {
          en: 'How do I use FLUX 3 Image Klein in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中使用 FLUX 3 Image Klein？'
        },
        answer: {
          en: 'Update ComfyUI to the latest version, download the FLUX 3 Image Klein weights from Hugging Face, and load the FLUX 3 Image Klein template. FLUX 3 Image Klein runs on ComfyUI’s standard loaders: Load Diffusion Model for the checkpoint, Load CLIP with type set to flux3 for the Qwen3-VL 4B text encoder, and Load VAE. No API key is needed.',
          'zh-CN':
            '将 ComfyUI 更新到最新版本，从 Hugging Face 下载 FLUX 3 Image Klein 权重，然后加载 FLUX 3 Image Klein 模板。FLUX 3 Image Klein 使用 ComfyUI 的标准加载器：用 Load Diffusion Model 加载 checkpoint，用 Load CLIP（type 设为 flux3）加载 Qwen3-VL 4B 文本编码器，再用 Load VAE 加载 VAE。无需 API 密钥。'
        }
      },
      {
        id: 'license',
        question: {
          en: 'Can I use FLUX 3 Image Klein commercially?',
          'zh-CN': 'FLUX 3 Image Klein 可以用于商业用途吗？'
        },
        answer: {
          en: `It depends on your revenue. FLUX 3 Image Klein is released under the FLUX Kommunity License, which allows free non-commercial use. If you and your affiliates have under US$5M in annual revenue, you can also use the images you generate commercially, provided you filter or review outputs and disclose AI generation where the law requires it. Any other commercial use, including commercial fine-tunes, needs a license from Black Forest Labs at [bfl.ai/licensing](${bflLicensing}).`,
          'zh-CN': `这取决于你的收入。FLUX 3 Image Klein 依据 FLUX Kommunity License 发布，允许免费的非商业使用。如果你及你的关联方年收入低于 500 万美元，你也可以将生成的图像用于商业用途，前提是对输出进行过滤或审核，并在法律要求时披露内容由 AI 生成。其他任何商业用途（包括商业微调）都需要向 Black Forest Labs 获取许可，详见 [bfl.ai/licensing](${bflLicensing})。`
        }
      },
      {
        id: 'cost',
        question: {
          en: 'How much does FLUX 3 Image Klein cost in ComfyUI?',
          'zh-CN': '在 ComfyUI 中使用 FLUX 3 Image Klein 需要多少费用？'
        },
        answer: {
          en: `FLUX 3 Image Klein is open weights, so running it locally in ComfyUI costs nothing per image beyond your own hardware. On Comfy Cloud it draws on your plan’s compute; see the [ComfyUI pricing page](${externalLinks.pricing}) for current rates. Cost and licensing are separate questions: the FLUX Kommunity License governs commercial use wherever you run it.`,
          'zh-CN': `FLUX 3 Image Klein 是开放权重模型，在 ComfyUI 中本地运行时，除自有硬件投入外，生成图像不产生任何按张计算的费用。在 Comfy Cloud 上则消耗套餐内的算力，当前费率请参阅 [ComfyUI 定价页面](${externalLinks.pricing})。费用与许可是两回事：无论在哪里运行，商业用途都受 FLUX Kommunity License 约束。`
        }
      },
      {
        id: 'vs-flux-2-klein',
        question: {
          en: 'How does FLUX 3 Image Klein compare to FLUX.2 [klein]?',
          'zh-CN': 'FLUX 3 Image Klein 与 FLUX.2 [klein] 相比如何？'
        },
        answer: {
          en: 'FLUX 3 Image Klein improves on FLUX.2 [klein] 9B in Black Forest Labs’ internal text-to-image evaluations while using fewer parameters, 5.6B against 9B. It also brings over control features from the larger FLUX 3 Image model, including bounding boxes, and generates natively at 4K.',
          'zh-CN':
            '在 Black Forest Labs 的内部文生图评测中，FLUX 3 Image Klein 表现优于 FLUX.2 [klein] 9B，参数量却更少（5.6B，后者为 9B）。它还继承了规模更大的 FLUX 3 Image 模型的控制功能（包括边界框），并可原生生成 4K 图像。'
        }
      },
      {
        id: 'partner-node',
        question: {
          en: 'Is FLUX 3 Image Klein the same as the FLUX 3 Image Partner Node in ComfyUI?',
          'zh-CN':
            'FLUX 3 Image Klein 与 ComfyUI 中的 FLUX 3 Image Partner Node 是同一个东西吗？'
        },
        answer: {
          en: 'No. The FLUX 3 Image Partner Node calls Black Forest Labs’ hosted API and runs the larger FLUX 3 Image model. FLUX 3 Image Klein is the open-weights model you download and run yourself, locally or on Comfy Cloud. Both are available in ComfyUI.',
          'zh-CN':
            '不是。FLUX 3 Image Partner Node 调用 Black Forest Labs 托管的 API，运行的是规模更大的 FLUX 3 Image 模型。FLUX 3 Image Klein 则是开放权重模型，由你自行下载，在本地或 Comfy Cloud 上运行。两者在 ComfyUI 中均可使用。'
        }
      },
      {
        id: 'versions',
        question: {
          en: 'Which versions of FLUX 3 Image Klein are available?',
          'zh-CN': 'FLUX 3 Image Klein 有哪些版本？'
        },
        answer: {
          en: 'FLUX 3 Image Klein ships as an undistilled base checkpoint for fine-tuning, further training, and research, and as a distilled checkpoint for faster generation. Both come with INT8, FP8 and NVFP4 quantized builds that use less memory. All of them run on the same ComfyUI loaders.',
          'zh-CN':
            'FLUX 3 Image Klein 提供用于微调、继续训练与研究的未蒸馏基础 checkpoint，以及生成速度更快的蒸馏 checkpoint。两者均提供占用显存更少的 INT8、FP8 与 NVFP4 量化版本。所有版本均使用相同的 ComfyUI 加载器运行。'
        }
      },
      {
        id: 'native-4k',
        question: {
          en: 'Does FLUX 3 Image Klein generate at 4K?',
          'zh-CN': 'FLUX 3 Image Klein 能生成 4K 图像吗？'
        },
        answer: {
          en: 'Yes. FLUX 3 Image Klein generates natively at 4K rather than upscaling to it. Fine detail holds up when you zoom in, crop, or print.',
          'zh-CN':
            '能。FLUX 3 Image Klein 原生生成 4K 图像，而不是通过超分辨率放大得到 4K。无论放大查看、裁剪还是打印，细节都依然清晰。'
        }
      },
      {
        id: 'bounding-boxes',
        question: {
          en: 'What are bounding boxes in FLUX 3 Image Klein?',
          'zh-CN': 'FLUX 3 Image Klein 中的边界框是什么？'
        },
        answer: {
          en: 'Bounding boxes let you mark regions of the canvas and say what goes in each, so FLUX 3 Image Klein follows your layout instead of choosing its own. They are useful for compositions with several subjects, product shots, and designs with text in fixed positions.',
          'zh-CN':
            '边界框让你在画布上标出区域，并指定每个区域放什么内容，使 FLUX 3 Image Klein 按照你的布局生成，而不是自行安排。它适用于多主体构图、产品图，以及文字位置固定的设计。'
        }
      },
      {
        id: 'prompt-upsampler',
        question: {
          en: 'What does the FLUX 3 prompt upsampler do?',
          'zh-CN': 'FLUX 3 提示词扩写器有什么作用？'
        },
        answer: {
          en: 'The prompt upsampler is a separate model that expands a short prompt into a detailed one before FLUX 3 Image Klein generates. In ComfyUI it loads through Load CLIP with type set to flux3. Try the same short prompt with and without it to see the difference.',
          'zh-CN':
            '提示词扩写器（prompt upsampler）是一个独立模型，会在 FLUX 3 Image Klein 生成之前，将简短的提示词扩展为详细的提示词。在 ComfyUI 中，它通过 Load CLIP（type 设为 flux3）加载。用同一条简短提示词分别在启用和不启用它的情况下生成，即可看出区别。'
        }
      },
      {
        id: 'fine-tuning',
        question: {
          en: 'Can I fine-tune FLUX 3 Image Klein or train LoRAs on it?',
          'zh-CN': '可以微调 FLUX 3 Image Klein 或在其上训练 LoRA 吗？'
        },
        answer: {
          en: 'Yes. The undistilled base checkpoint of FLUX 3 Image Klein is built for fine-tuning and further training, and LoRAs trained on it load through ComfyUI’s standard LoRA loader. Under the FLUX Kommunity License, fine-tuning for commercial use requires a separate license from Black Forest Labs.',
          'zh-CN':
            '可以。FLUX 3 Image Klein 的未蒸馏基础 checkpoint 专为微调与继续训练而构建，在其上训练的 LoRA 可通过 ComfyUI 的标准 LoRA 加载器加载。根据 FLUX Kommunity License，用于商业用途的微调需要另行向 Black Forest Labs 获取许可。'
        }
      }
    ]
  },
  runOptions: {
    ...qwenImage21Page.runOptions,
    subtitleKey: 'flux3Image.runOptions.subtitle'
  }
}
