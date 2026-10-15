import type { LocalizedText, TranslationKey } from '@/i18n/translations'
import type {
  ModelLaunchGallery,
  ModelLaunchPage
} from '@/templates/model-launch/types'

const mediaBase = '/media/krea-3'
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
  note: text('Krea 3 demo', 'Krea 3 演示'),
  media: { kind: 'image', src: `${mediaBase}/${id}.jpg` },
  href: '#edit-workflow',
  expandable: true
})

export const krea3Page = {
  hero: {
    layout: 'media-first',
    videoSrc: `${mediaBase}/hero.mp4`,
    posterSrc: `${mediaBase}/hero-poster.jpg`,
    logoSrc: '/icons/ai-models/krea.svg',
    titleKey: 'krea3.hero.title',
    descriptionKey: 'krea3.hero.description',
    primaryCta: { labelKey: 'krea3.hero.cta', href: '#edit-workflow' },
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
        question: text('What is Krea 3?', 'Krea 3 是什么？'),
        answer: text(
          'Krea 3 is an image model from Krea built for reference-driven generation and editing. Start with visual references and describe what you want to change.',
          'Krea 3 是 Krea 推出的图像模型，用于参考图驱动的生成与编辑。从视觉参考图出发，描述你想修改的内容。'
        )
      },
      {
        id: 'video',
        question: text(
          'Does Krea 3 generate video?',
          'Krea 3 可以生成视频吗？'
        ),
        answer: text(
          'Krea 3 is an image model. The hero video demonstrates image-editing workflows. You can use selected stills as inputs to a separate video workflow.',
          'Krea 3 是图像模型。页面顶部的视频演示了图像编辑工作流。你可以将选定的静帧作为独立视频工作流的输入。'
        )
      },
      {
        id: 'references',
        question: text(
          'How should I use multiple references?',
          '如何使用多张参考图？'
        ),
        answer: text(
          'Give each reference a clear role and refer to images by input order. State which details should stay, then inspect those details in the result.',
          '为每张参考图明确分配用途，并按输入顺序指明图像。说明要保留的细节，再检查结果中的对应细节。'
        )
      }
    ]
  },
  closingCta: {
    headingKey: 'krea3.closing.heading',
    subtitleKey: 'krea3.closing.description',
    primaryCta: {
      labelKey: 'krea3.closing.cta',
      href: 'https://cloud.comfy.org/?utm_source=comfy.org&utm_medium=referral&utm_campaign=krea-3',
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
  steps: NonNullable<ModelLaunchPage['steps']>
  faq: NonNullable<ModelLaunchPage['faq']>
  closingCta: NonNullable<ModelLaunchPage['closingCta']>
}
