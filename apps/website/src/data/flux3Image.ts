import type { ModelLaunchPage } from '@/templates/model-launch/types'

import { qwenImage21Page } from './qwenImage21'

const mediaBase = 'https://media.comfy.org/website/flux-3-image'

const sampleCard = {
  tier: 'free',
  href: '#launch-links'
} as const

export const flux3ImagePage: ModelLaunchPage = {
  ...qwenImage21Page,
  metaTitleKey: 'flux3Image.meta.title',
  metaDescriptionKey: 'flux3Image.hero.description',
  breadcrumbLabelKey: 'flux3Image.hero.title',
  breadcrumbUpdatedKey: 'flux3Image.breadcrumb.updated',
  hero: {
    layout: 'media-first',
    titleKey: 'flux3Image.hero.title',
    descriptionKey: 'flux3Image.hero.description',
    badgeKeys: [
      'flux3Image.hero.openSource',
      'flux3Image.hero.imageGeneration',
      'flux3Image.hero.imageEdit'
    ],
    primaryCta: {
      labelKey: 'flux3Image.hero.primaryCta',
      href: '#launch-links'
    },
    secondaryCta: {
      labelKey: 'flux3Image.hero.secondaryCta',
      href: '#launch-links'
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
        href: '#launch-links'
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
          en: "FLUX 3 Image Klein is an open-weight image model from Black Forest Labs. It has 5.6B parameters, runs on a single consumer GPU, and draws on FLUX 3's shared learning across image, video, and audio. It keeps the control features of the larger FLUX 3 Image model, including bounding boxes, and handles both generation and editing.",
          'zh-CN':
            'FLUX 3 Image Klein 是 Black Forest Labs 推出的开放权重图像模型。它拥有 5.6B 参数，可在单张消费级 GPU 上运行，并受益于 FLUX 3 跨图像、视频与音频的共享学习。它保留了规模更大的 FLUX 3 Image 模型的控制功能（包括边界框），同时支持图像生成与编辑。'
        }
      },
      {
        id: 'versions',
        question: {
          en: 'What is the difference between standard and turbo?',
          'zh-CN': '标准版和 turbo 版有什么区别？'
        },
        answer: {
          en: 'Standard is the undistilled base checkpoint, released in full for fine-tuning, further training, and research. Turbo is the step-distilled version, built for low-latency generation and self-hosting. Both are open weights. FP8 and NVFP4 quantized versions are also available.',
          'zh-CN':
            '标准版是未蒸馏的基础 checkpoint，完整开放，可用于微调、继续训练与研究。turbo 版是步数蒸馏版本，面向低延迟生成与自托管部署。两者均为开放权重。另提供 FP8 与 NVFP4 量化版本。'
        }
      },
      {
        id: 'hardware',
        question: {
          en: 'What hardware do I need?',
          'zh-CN': '需要什么样的硬件？'
        },
        answer: {
          en: 'At 5.6B parameters, FLUX 3 Image Klein runs on a single consumer GPU. FP8 and NVFP4 quantized versions are also available.',
          'zh-CN':
            'FLUX 3 Image Klein 拥有 5.6B 参数，可在单张消费级 GPU 上运行。另提供 FP8 与 NVFP4 量化版本。'
        }
      },
      {
        id: 'setup',
        question: {
          en: 'How do I use FLUX 3 Image Klein in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中使用 FLUX 3 Image Klein？'
        },
        answer: {
          en: 'ComfyUI supports FLUX 3 Image Klein from launch day. Add the launch workflow, model download links, and setup steps here.',
          'zh-CN':
            'ComfyUI 自发布当天起即支持 FLUX 3 Image Klein。在此添加发布工作流、模型下载链接及设置步骤。'
        }
      },
      {
        id: 'editing',
        question: {
          en: 'Can I edit images with FLUX 3 Image Klein?',
          'zh-CN': '可以用 FLUX 3 Image Klein 编辑图像吗？'
        },
        answer: {
          en: 'Yes. Add, replace, remove, or restyle specific elements without needlessly changing the rest of the image. Use multiple reference images to keep characters and subjects recognizable across edits, apply the style of a reference while keeping your intended content and composition, and render or edit text inside the image.',
          'zh-CN':
            '可以。你可以对图像中的特定元素进行添加、替换、删除或风格重塑，而不会对图像其余部分做不必要的改动。使用多张参考图像，可在多次编辑中保持角色与主体的辨识度；还可以套用参考图像的风格，同时保留你想要的内容与构图，并在图像中渲染或编辑文字。'
        }
      },
      {
        id: 'layout',
        question: {
          en: 'Can I control the layout of an image?',
          'zh-CN': '可以控制图像的布局吗？'
        },
        answer: {
          en: 'Yes. Bounding boxes let you place elements and set the exact composition and layout of the image.',
          'zh-CN':
            '可以。借助边界框，你可以指定各元素的位置，精确设定图像的构图与布局。'
        }
      },
      {
        id: 'resolution',
        question: {
          en: 'What image sizes are supported?',
          'zh-CN': '支持哪些图像尺寸？'
        },
        answer: {
          en: 'Through the BFL API, the turbo model generates natively at up to 4K, which holds small details when you zoom in, crop, or print. Proposed pricing covers 768 × 768, 1K, 1.5K, 2K, and 4K outputs.',
          'zh-CN':
            '通过 BFL API，turbo 版模型可原生生成最高 4K 的图像，在放大查看、裁剪或打印时仍能保留细微细节。拟定定价涵盖 768 × 768、1K、1.5K、2K 与 4K 输出。'
        }
      },
      {
        id: 'fine-tuning',
        question: {
          en: 'Can I fine-tune FLUX 3 Image Klein?',
          'zh-CN': '可以微调 FLUX 3 Image Klein 吗？'
        },
        answer: {
          en: "Yes. The standard version is the full undistilled base checkpoint, released for fine-tuning and further training. Launch tooling includes Ostris's AI Toolkit, ComfyUI, Diffusers, SGLang, and vLLM, plus NVIDIA fine-tuning recipes and deployment optimizations.",
          'zh-CN':
            '可以。标准版是完整的未蒸馏基础 checkpoint，专为微调与继续训练而发布。发布时的工具支持包括 Ostris 的 AI Toolkit、ComfyUI、Diffusers、SGLang 和 vLLM，并提供 NVIDIA 微调方案与部署优化。'
        }
      },
      {
        id: 'cost',
        question: {
          en: 'How much does FLUX 3 Image Klein cost?',
          'zh-CN': 'FLUX 3 Image Klein 的费用是多少？'
        },
        answer: {
          en: 'Running the open weights locally in ComfyUI has no per-image charge; check the license terms below before commercial use. Proposed pricing is the same for text-to-image and image-to-image: $0.008 at 768 × 768, $0.009 at 1K, $0.011 at 1.5K, $0.014 at 2K, and $0.036 at 4K per image.',
          'zh-CN':
            '在 ComfyUI 中本地运行开放权重模型不按张收费；用于商业用途前，请查阅下方的许可条款。拟定定价对文生图与图生图相同：768 × 768 每张 $0.008，1K 每张 $0.009，1.5K 每张 $0.011，2K 每张 $0.014，4K 每张 $0.036。'
        }
      },
      {
        id: 'license',
        question: {
          en: 'Can I use FLUX 3 Image Klein commercially?',
          'zh-CN': 'FLUX 3 Image Klein 可以用于商业用途吗？'
        },
        answer: {
          en: 'Add the official license and commercial usage terms here.',
          'zh-CN': '在此添加官方许可证和商业使用条款。'
        }
      }
    ]
  },
  runOptions: {
    ...qwenImage21Page.runOptions,
    subtitleKey: 'flux3Image.runOptions.subtitle'
  }
}
