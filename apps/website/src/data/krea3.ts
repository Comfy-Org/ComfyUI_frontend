import type { LocalizedText, TranslationKey } from '@/i18n/translations'
import type {
  ModelLaunchGallery,
  ModelLaunchPage
} from '@/templates/model-launch/types'

export const krea3Links = {
  textToImage: 'https://cloud.comfy.org/?template=api_krea3_t2i',
  imageEdit: 'https://cloud.comfy.org/?template=api_krea3_image_edit'
} as const

const mediaBase = 'https://media.comfy.org/website/krea-3'
const text = (en: string, zh: string): LocalizedText => ({ en, 'zh-CN': zh })
const card = (
  id: string,
  name: LocalizedText,
  description: LocalizedText,
  prompt?: LocalizedText
): ModelLaunchGallery['cards'][number] => ({
  id,
  name,
  description,
  prompt,
  tier: 'premium',
  note: text('Pay-as-you-go', '按量付费'),
  media: { kind: 'image', src: `${mediaBase}/${id}.jpg` },
  href: krea3Links.imageEdit,
  expandable: true
})

export const krea3Page = {
  hero: {
    layout: 'media-first',
    videoSrc:
      'https://media.comfy.org/website/krea-3/krea3-16x9-jp-20261015-d009ff37.mp4',
    posterSrc: `${mediaBase}/hero-poster.jpg`,
    logoSrc: '/icons/ai-models/krea.svg',
    titleKey: 'krea3.hero.title',
    descriptionKey: 'krea3.hero.description',
    primaryCta: {
      labelKey: 'krea3.hero.cta',
      href: krea3Links.imageEdit,
      target: '_blank'
    },
    secondaryCta: { labelKey: 'krea3.hero.workflows', href: '#edit-workflow' },
    badgeKeys: ['krea3.hero.references', 'krea3.hero.image']
  },
  comparison: {
    headingKey: 'krea3.references',
    beforeSrc: `${mediaBase}/reference-before.jpg`,
    afterSrc: `${mediaBase}/reference-after.jpg`,
    prompt: text(
      'Swap the flag for a flamingo pool float',
      '将旗帜替换为火烈鸟泳圈'
    )
  },
  galleries: [
    {
      headingKey: 'krea3.products',
      ctaVariant: 'none',
      cardMeta: 'none',
      cards: [
        card(
          'product-input',
          text('BRING THE PRODUCT', '带入产品参考图'),
          text(
            'Use a product reference to define its shape, material, and identifying details.',
            '通过产品参考图明确形状、材质和标志性细节。'
          )
        ),
        card(
          'product-result',
          text('DIRECT THE SETTING', '设定场景'),
          text(
            'Try another setting or composition. Check the product details against your reference before selecting an output.',
            '尝试不同场景或构图。在选定结果前，对照参考图检查产品细节。'
          )
        )
      ]
    },
    {
      headingKey: 'krea3.interiors',
      ctaVariant: 'none',
      cardMeta: 'none',
      cards: [
        card(
          'finish-before',
          text('SET THE STARTING POINT', '确定起点'),
          text(
            'Start with the room and viewpoint you want to work from.',
            '从你希望采用的房间和视角出发。'
          )
        ),
        card(
          'finish-after',
          text('TRY ANOTHER FINISH', '尝试另一种饰面'),
          text(
            'Explore surfaces, materials, and colors. Name the elements that should stay in place.',
            '探索表面、材质和色彩，并明确应保持不变的元素。'
          )
        )
      ]
    },
    {
      headingKey: 'krea3.characters',
      ctaVariant: 'none',
      cardMeta: 'none',
      cards: [
        card(
          'character-before',
          text('DEFINE THE IDENTITY', '确定角色身份'),
          text(
            'Give each reference a job: identity, wardrobe, or environment.',
            '为每张参考图分配用途：角色身份、服装或环境。'
          )
        ),
        card(
          'character-after',
          text('BUILD THE NEXT STILL', '创作下一张静帧'),
          text(
            'Direct a new look or scene, then carry your selected stills into a video workflow.',
            '设定新的造型或场景，再将选定的静帧带入视频工作流。'
          )
        )
      ]
    }
  ],
  workflowGallery: {
    headingKey: 'krea3.workflows.heading',
    ctaVariant: 'accent',
    cardMeta: 'default',
    cards: [
      {
        ...card(
          'reference-after',
          text('Krea 3: Image editing', 'Krea 3：图像编辑'),
          text(
            'Image editing. Bring a reference image and describe what to change.',
            '图像编辑。加载参考图，描述需要修改的内容。'
          )
        ),
        media: { kind: 'image', src: `${mediaBase}/image-editing.webp` },
        href: krea3Links.imageEdit
      },
      {
        ...card(
          'product-result',
          text('Krea 3: Text to image', 'Krea 3：文生图'),
          text(
            'Text to image. Set the subject, setting, and visual direction with a prompt.',
            '文生图。通过提示词设定主体、场景和视觉方向。'
          )
        ),
        media: { kind: 'image', src: `${mediaBase}/text-to-image.jpg` },
        href: krea3Links.textToImage
      }
    ]
  },
  steps: {
    headingKey: 'krea3.steps.heading',
    stepLabelKey: 'krea3.steps.label',
    items: [
      {
        id: 'references',
        title: text('Load your references', '加载参考图'),
        description: text(
          'Start with a product, a person, a room, or a set of visual references.',
          '从产品、人物、房间或一组视觉参考图开始。'
        )
      },
      {
        id: 'direction',
        title: text('Describe the edit', '描述编辑要求'),
        description: text(
          'Say what to change and what to keep. With multiple references, identify each image by its input order.',
          '说明要修改和保留的内容。使用多张参考图时，按输入顺序指明每张图。'
        )
      },
      {
        id: 'iterate',
        title: text('Compare and continue', '对比并继续'),
        description: text(
          'Inspect the result. Use a selected output as the starting point for the next edit.',
          '检查结果，选择合适的输出作为下一次编辑的起点。'
        )
      }
    ]
  },
  faq: {
    headingKey: 'krea3.faq',
    items: [
      {
        id: 'what',
        question: text(
          'What is Krea 3, and how does it differ from traditional AI image tools?',
          'What is Krea 3, and how does it differ from traditional AI image tools?'
        ),
        answer: text(
          'Krea 3 is an AI image editing model engineered for targeted visual edits. Unlike standard AI generators that redraw the entire image from scratch, Krea 3 performs pixel-perfect regional editing, modifying only what you specify while keeping the rest of your original image 100% untouched.',
          'Krea 3 is an AI image editing model engineered for targeted visual edits. Unlike standard AI generators that redraw the entire image from scratch, Krea 3 performs pixel-perfect regional editing, modifying only what you specify while keeping the rest of your original image 100% untouched.'
        )
      },
      {
        id: 'speed',
        question: text(
          'How fast is Krea 3 when editing images?',
          'How fast is Krea 3 when editing images?'
        ),
        answer: text(
          'Krea 3 finishes an edit in under 8 seconds per output. This rapid speed allows creators, designers, and marketers to iterate on visual ideas and test design variations almost instantly.',
          'Krea 3 finishes an edit in under 8 seconds per output. This rapid speed allows creators, designers, and marketers to iterate on visual ideas and test design variations almost instantly.'
        )
      },
      {
        id: 'precision',
        question: text(
          'How does regional precision and exact color matching work in Krea 3?',
          'How does regional precision and exact color matching work in Krea 3?'
        ),
        answer: text(
          'Krea 3 offers two key tools for fine visual control:\n• **Regional Precision:** Simply draw a box over a specific area to edit that region exclusively, achieving zero unintended pixel changes outside your selection.\n• **Hex Color Matching:** Name an exact Hex color code (e.g., #D9C3A3) in your prompt to apply precise brand or product colors directly onto apparel, furniture, or props.',
          'Krea 3 offers two key tools for fine visual control:\n• **Regional Precision:** Simply draw a box over a specific area to edit that region exclusively, achieving zero unintended pixel changes outside your selection.\n• **Hex Color Matching:** Name an exact Hex color code (e.g., #D9C3A3) in your prompt to apply precise brand or product colors directly onto apparel, furniture, or props.'
        )
      },
      {
        id: 'consistency',
        question: text(
          'Can Krea 3 maintain character consistency across different scenes?',
          'Can Krea 3 maintain character consistency across different scenes?'
        ),
        answer: text(
          'Yes. Krea 3 features dedicated subject consistency capabilities. You can change a character’s outfit, setting, lighting, or camera angle while preserving their facial features and identity across a sequence of edits.',
          'Yes. Krea 3 features dedicated subject consistency capabilities. You can change a character’s outfit, setting, lighting, or camera angle while preserving their facial features and identity across a sequence of edits.'
        )
      },
      {
        id: 'references',
        question: text(
          'How many reference images can I combine, and what is the output resolution?',
          'How many reference images can I combine, and what is the output resolution?'
        ),
        answer: text(
          'Krea 3 allows you to combine up to 8 visual reference images (mixing people, products, backgrounds, and art styles) into a single cohesive output. It renders natively at crisp 2K resolution (e.g., 2736 × 1536 px).',
          'Krea 3 allows you to combine up to 8 visual reference images (mixing people, products, backgrounds, and art styles) into a single cohesive output. It renders natively at crisp 2K resolution (e.g., 2736 × 1536 px).'
        )
      },
      {
        id: 'industries',
        question: text(
          'What creative industries and workflows is Krea 3 built for?',
          'What creative industries and workflows is Krea 3 built for?'
        ),
        answer: text(
          'Krea 3 comes with 251 launch presets tailored for creative professionals across multiple fields:\n• **E-Commerce & Marketing:** Swap product staging backgrounds, re-skin packaging, and update ad layouts while keeping brand typography intact.\n• **Fashion & Photography:** Relight portraits, restyle apparel, and perform virtual model staging.\n• **Architecture & Interior Design:** Transform raw sketches/blockouts into photo-realistic renders and virtual room stagings.',
          'Krea 3 comes with 251 launch presets tailored for creative professionals across multiple fields:\n• **E-Commerce & Marketing:** Swap product staging backgrounds, re-skin packaging, and update ad layouts while keeping brand typography intact.\n• **Fashion & Photography:** Relight portraits, restyle apparel, and perform virtual model staging.\n• **Architecture & Interior Design:** Transform raw sketches/blockouts into photo-realistic renders and virtual room stagings.'
        )
      }
    ]
  },
  closingCta: {
    headingKey: 'krea3.closing.heading',
    subtitleKey: 'krea3.closing.description',
    primaryCta: {
      labelKey: 'krea3.closing.cta',
      href: krea3Links.imageEdit,
      target: '_blank'
    }
  }
} satisfies {
  hero: ModelLaunchPage['hero']
  comparison: {
    headingKey: TranslationKey
    beforeSrc: string
    afterSrc: string
    prompt: LocalizedText
  }
  galleries: readonly ModelLaunchGallery[]
  workflowGallery: ModelLaunchGallery
  steps: NonNullable<ModelLaunchPage['steps']>
  faq: NonNullable<ModelLaunchPage['faq']>
  closingCta: NonNullable<ModelLaunchPage['closingCta']>
}
