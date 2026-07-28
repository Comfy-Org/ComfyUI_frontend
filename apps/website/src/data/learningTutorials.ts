import type { VideoTrack } from '../components/common/VideoPlayer.vue'
import type {
  Locale,
  LocalizedText,
  TranslationKey
} from '../i18n/translations'

import { t } from '../i18n/translations'

export type LearningCategory = 'vfx' | 'animations' | 'ads'

export interface LearningTutorial {
  id: string
  /** Kebab-case, human-readable — the SEO slug in /learning/<category>/<slug>. */
  slug: string
  category: LearningCategory
  tags: readonly TranslationKey[]
  title: LocalizedText
  /** Optional authored copy; when absent the detail page uses a template. */
  description?: LocalizedText
  videoSrc: string
  href?: string
  /** Open the workflow link in a new tab (e.g. cloud.comfy.org). */
  newTab?: boolean
  poster: string
  caption?: readonly VideoTrack[]
  /** ISO date the video was uploaded; feeds VideoObject.uploadDate. */
  publishedDate: string
}

/** Category slugs, in nav order — also drives the /learning/[slug] routes. */
export const learningCategories: readonly LearningCategory[] = [
  'vfx',
  'animations',
  'ads'
]

export const categoryLabelKeys: Record<LearningCategory, TranslationKey> = {
  vfx: 'learning.categories.vfx',
  animations: 'learning.categories.animations',
  ads: 'learning.categories.ads'
}

export const categoryBlurbKeys: Record<LearningCategory, TranslationKey> = {
  vfx: 'learning.categories.vfx.blurb',
  animations: 'learning.categories.animations.blurb',
  ads: 'learning.categories.ads.blurb'
}

/** Per-vertical h1 (the "All" view falls back to the generic learning title). */
const categoryHeadingKeys: Record<LearningCategory, TranslationKey> = {
  vfx: 'learning.categories.vfx.heading',
  animations: 'learning.categories.animations.heading',
  ads: 'learning.categories.ads.heading'
}

/** Per-vertical lead-in, reused as the page description / meta description. */
const categoryDescriptionKeys: Record<LearningCategory, TranslationKey> = {
  vfx: 'learning.categories.vfx.description',
  animations: 'learning.categories.animations.description',
  ads: 'learning.categories.ads.description'
}

/** Visible h1 for a directory page: per-vertical when filtered, else generic. */
export const learningHeading = (
  locale: Locale,
  category?: LearningCategory
): string =>
  t(category ? categoryHeadingKeys[category] : 'learning.title', locale)

/** Lead-in and meta description for a directory page. */
export const learningDescription = (
  locale: Locale,
  category?: LearningCategory
): string =>
  t(category ? categoryDescriptionKeys[category] : 'learning.tagline', locale)

/** Document / social title for a directory page. */
export const learningMetaTitle = (
  locale: Locale,
  category?: LearningCategory
): string => `${learningHeading(locale, category)} - Comfy`

const partnerNodesTag: TranslationKey = 'tags.partnerNodes'
const imageToVideoTag: TranslationKey = 'tags.imageToVideo'
const imageGenerationTag: TranslationKey = 'tags.imageGeneration'
const styleTransferTag: TranslationKey = 'tags.styleTransfer'
const moodboardsTag: TranslationKey = 'tags.moodboards'
const storyboardingTag: TranslationKey = 'tags.storyboarding'
const productPhotographyTag: TranslationKey = 'tags.productPhotography'
const previsualizationTag: TranslationKey = 'tags.previsualization'
const bRollTag: TranslationKey = 'tags.bRoll'
const outOfHomeTag: TranslationKey = 'tags.outOfHome'
const characterDesignTag: TranslationKey = 'tags.characterDesign'
const keyframingTag: TranslationKey = 'tags.keyframing'
const backgroundsTag: TranslationKey = 'tags.backgrounds'
const threeDTag: TranslationKey = 'tags.threeD'
const inBetweeningTag: TranslationKey = 'tags.inBetweening'
const compositingTag: TranslationKey = 'tags.compositing'

export const learningTutorials: readonly LearningTutorial[] = [
  {
    id: 'cleanplate_walkthrough_v03',
    publishedDate: '2026-05-26',
    slug: 'cleanplate-walkthrough',
    category: 'vfx',
    title: { en: 'Cleanplate Walkthrough', 'zh-CN': '净板演练' },
    videoSrc:
      'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg',
    caption: [
      {
        src: 'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    href: 'https://comfy.org/workflows/8f2cf0df5da6-8f2cf0df5da6/',
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'deaging_workflow_v03',
    publishedDate: '2026-05-26',
    slug: 'deaging-workflow',
    category: 'vfx',
    title: { en: 'Deaging Workflow', 'zh-CN': '减龄工作流' },
    videoSrc:
      'https://media.comfy.org/website/learning/deaging_workflow_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/deaging_workflow_v03_thumbnail.jpg',
    href: 'https://comfy.org/workflows/93f286fbc2c8-93f286fbc2c8/',
    caption: [
      {
        src: 'https://media.comfy.org/website/learning/deaging_workflow_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'frame_adjustments_demo_v03',
    publishedDate: '2026-05-26',
    slug: 'frame-adjustments',
    category: 'vfx',
    title: { en: 'Frame Adjustments Demo', 'zh-CN': '帧调整演示' },
    videoSrc:
      'https://media.comfy.org/website/learning/frame_adjustments_demo_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/frame_adjustments_demo_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=7dca0438edf4',
    newTab: true,
    caption: [
      {
        src: 'https://media.comfy.org/website/learning/frame_adjustments_demo_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'mattes_and_utilities_v03',
    publishedDate: '2026-05-26',
    slug: 'mattes-and-utilities',
    category: 'vfx',
    title: { en: 'Mattes and Utilities', 'zh-CN': '遮罩与实用工具' },
    videoSrc:
      'https://media.comfy.org/website/learning/mattes_and_utilities_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/mattes_and_utilities_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=be0889296f65',
    newTab: true,
    caption: [
      {
        src: 'https://media.comfy.org/website/learning/mattes_and_utilities_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'seedance_demo_comfyui_v03',
    publishedDate: '2026-05-26',
    slug: 'seedance-demo',
    category: 'vfx',
    title: { en: 'Seedance Demo ComfyUI', 'zh-CN': 'Seedance ComfyUI 演示' },
    videoSrc:
      'https://media.comfy.org/website/learning/seedance_demo_comfyui_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/seedance_demo_comfyui_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=ef543bd4a773',
    newTab: true,
    caption: [
      {
        src: 'https://media.comfy.org/website/learning/seedance_demo_comfyui_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'skyreplacement_smaller_v06',
    publishedDate: '2026-05-26',
    slug: 'sky-replacement',
    category: 'vfx',
    title: { en: 'Sky Replacement', 'zh-CN': '天空替换' },
    videoSrc:
      'https://media.comfy.org/website/learning/skyreplacement_smaller_v06.mp4',
    poster:
      'https://media.comfy.org/website/learning/skyreplacement_smaller_v06_thumbnail.jpg',
    href: 'https://comfy.org/workflows/537cf7f1f745-537cf7f1f745/',
    caption: [
      {
        src: 'https://media.comfy.org/website/learning/skyreplacement_smaller_v06_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'animation_character_sheet',
    publishedDate: '2026-07-16',
    slug: 'character-sheet',
    category: 'animations',
    title: { en: 'Character Sheet', 'zh-CN': '角色设定表' },
    description: {
      en: 'Turn concept art into a full character sheet with this ComfyUI workflow — GPT Image 2 generates body turnarounds and face close-ups, then auto-stitches them.',
      'zh-CN':
        '用此 ComfyUI 工作流将概念美术转化为完整的角色设定表——GPT Image 2 生成全身转身视图与面部特写，并自动拼接成一张图。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/animation1.mp4',
    poster: 'https://media.comfy.org/website/learning/animation1-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=d8414beacf91',
    newTab: true,
    tags: [partnerNodesTag, imageGenerationTag, characterDesignTag]
  },
  {
    id: 'animation_keyframe_exploration',
    publishedDate: '2026-07-16',
    slug: 'keyframe-exploration',
    category: 'animations',
    title: { en: 'Keyframe Exploration', 'zh-CN': '关键帧探索' },
    description: {
      en: 'Generate a character keyframe at any camera angle with this ComfyUI workflow — set direction, elevation, and distance, then GPT Image 2 renders the shot.',
      'zh-CN':
        '用此 ComfyUI 工作流在任意机位角度生成角色关键帧——设置方向、俯仰和距离，再由 GPT Image 2 渲染出画面。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/animation2.mp4',
    poster: 'https://media.comfy.org/website/learning/animation2-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=78a07a3ce040',
    newTab: true,
    tags: [partnerNodesTag, imageGenerationTag, keyframingTag]
  },
  {
    id: 'animation_background_and_asset_generation',
    publishedDate: '2026-07-16',
    slug: 'background-and-asset-generation',
    category: 'animations',
    title: { en: 'Background and Asset Generation', 'zh-CN': '背景与素材生成' },
    description: {
      en: 'Apply a production frame’s style to backgrounds and props with this ComfyUI workflow — GPT Image 2 paints sketches to match, with auto background removal.',
      'zh-CN':
        '用此 ComfyUI 工作流将制作帧的风格应用到背景与道具——GPT Image 2 将草图绘制成匹配风格，并自动去除背景。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/animation3.mp4',
    poster: 'https://media.comfy.org/website/learning/animation3-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=1d905d914f11',
    newTab: true,
    tags: [
      partnerNodesTag,
      imageGenerationTag,
      styleTransferTag,
      backgroundsTag
    ]
  },
  {
    id: 'animation_concept_exploration',
    publishedDate: '2026-07-16',
    slug: 'concept-exploration',
    category: 'animations',
    title: { en: 'Concept Exploration', 'zh-CN': '概念探索' },
    description: {
      en: 'Turn concept art into a poseable 3D proxy with this ComfyUI workflow — Tripo builds the model, then generate a styled still or camera-move video from any angle.',
      'zh-CN':
        '用此 ComfyUI 工作流将概念美术转化为可摆姿的 3D 代理——Tripo 生成模型，再从任意角度生成风格化静帧或运镜视频。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/animation4.mp4',
    poster: 'https://media.comfy.org/website/learning/animation4-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=098f35ab854f',
    newTab: true,
    tags: [partnerNodesTag, imageGenerationTag, imageToVideoTag, threeDTag]
  },
  {
    id: 'animation_in_betweening',
    publishedDate: '2026-07-16',
    slug: 'in-betweening',
    category: 'animations',
    title: { en: 'In-Betweening', 'zh-CN': '中间帧绘制' },
    description: {
      en: 'Generate the in-between frames from a sequence of keyframes with this ComfyUI workflow — Wan 2.2 interpolates each pair into one assembled character animation.',
      'zh-CN':
        '用此 ComfyUI 工作流从关键帧序列生成中间帧——Wan 2.2 对每一对关键帧进行插值，拼接成一段完整的角色动画。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/animation5.mp4',
    poster: 'https://media.comfy.org/website/learning/animation5-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=7e6419542193',
    newTab: true,
    tags: [imageToVideoTag, keyframingTag, inBetweeningTag]
  },
  {
    id: 'animation_background_and_compositing',
    publishedDate: '2026-07-16',
    slug: 'background-and-compositing',
    category: 'animations',
    title: { en: 'Background and Compositing', 'zh-CN': '背景与合成' },
    description: {
      en: 'Animate backgrounds and composite characters with this ComfyUI workflow — Cdance loops still backgrounds, then blends the character with matched lighting.',
      'zh-CN':
        '用此 ComfyUI 工作流让背景动起来并合成角色——Cdance 将静态背景生成循环动画，再以匹配的光照将角色融合其中。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/animation6.mp4',
    poster: 'https://media.comfy.org/website/learning/animation6-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=ea6c80d417cf',
    newTab: true,
    tags: [partnerNodesTag, imageToVideoTag, styleTransferTag, compositingTag]
  },
  {
    id: 'ad_moodboard_creation',
    publishedDate: '2026-07-20',
    slug: 'moodboard-creation',
    category: 'ads',
    title: { en: 'Moodboard Creation', 'zh-CN': '情绪板制作' },
    description: {
      en: 'Turn mood board selects into fresh, on-brand ad visuals with this ComfyUI workflow — extract a style with Recraft, or alter elements with GPT Image 2.',
      'zh-CN':
        '通过此 ComfyUI 工作流，将情绪板参考图转化为符合品牌调性的全新广告视觉——用 Recraft 提取风格，或用 GPT Image 2 调整元素。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/advertising1.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising1-thumb.png',
    href: 'https://cloud.comfy.org/?share=62f892c540e3',
    newTab: true,
    tags: [partnerNodesTag, imageGenerationTag, styleTransferTag, moodboardsTag]
  },
  {
    id: 'ad_storyboard_creation',
    publishedDate: '2026-07-20',
    slug: 'storyboard-creation',
    category: 'ads',
    title: { en: 'Storyboard Creation', 'zh-CN': '故事板制作' },
    description: {
      en: 'Generate an ad storyboard from a shot list, then render polished style frames — a ComfyUI workflow using GPT Image and NanoBanana Pro across two passes.',
      'zh-CN':
        '通过此 ComfyUI 工作流，从镜头表生成广告故事板，再渲染精致的风格帧——两个阶段分别使用 GPT Image 与 NanoBanana Pro。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/advertising2.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising2-thumb.png',
    href: 'https://cloud.comfy.org/?share=a598339548b3',
    newTab: true,
    tags: [
      partnerNodesTag,
      imageGenerationTag,
      styleTransferTag,
      storyboardingTag
    ]
  },
  {
    id: 'ad_product_photography',
    publishedDate: '2026-07-20',
    slug: 'product-photography',
    category: 'ads',
    title: { en: 'Product Photography', 'zh-CN': '产品摄影' },
    description: {
      en: 'Generate, retouch, and animate product shots in one ComfyUI workflow — place products with GPT Image, mask-edit details, then create a hero video.',
      'zh-CN':
        '在一套 ComfyUI 工作流中生成、修饰并让产品照片动起来——用 GPT Image 置入产品，蒙版编辑细节，再生成主打视频。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/advertising3.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising3-thumb.png',
    href: 'https://cloud.comfy.org/?share=2d5b0cdf915a',
    newTab: true,
    tags: [
      partnerNodesTag,
      imageGenerationTag,
      imageToVideoTag,
      productPhotographyTag
    ]
  },
  {
    id: 'ad_talent_casting',
    publishedDate: '2026-07-20',
    slug: 'talent-casting',
    category: 'ads',
    title: { en: 'Talent Casting', 'zh-CN': '演员选角' },
    description: {
      en: 'Preview talent in a scene before the shoot with this ComfyUI workflow — generate a previs still with Gemini Image 2, then animate it into a clip with Kling.',
      'zh-CN':
        '在开拍前用此 ComfyUI 工作流预览演员在场景中的效果——用 Gemini Image 2 生成预演静帧，再用 Kling 将其动画化为短片。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/advertising4.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising4-thumb.png',
    href: 'https://cloud.comfy.org/?share=1233f85f1c96',
    newTab: true,
    tags: [
      partnerNodesTag,
      imageGenerationTag,
      imageToVideoTag,
      previsualizationTag
    ]
  },
  {
    id: 'ad_broll_creation',
    publishedDate: '2026-07-20',
    slug: 'b-roll-creation',
    category: 'ads',
    title: { en: 'B-Roll Creation', 'zh-CN': 'B-Roll 素材制作' },
    description: {
      en: 'Create or edit B-roll three ways in one ComfyUI workflow — generate a clip from a prompt, place a subject into a reference scene, or alter existing footage.',
      'zh-CN':
        '在一套 ComfyUI 工作流中以三种方式创建或编辑 B-Roll 素材——用提示词生成片段、将主体置入参考场景，或修改现有素材。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/advertising5.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising5-thumb.png',
    href: 'https://cloud.comfy.org/?share=dd1946bdd7c8',
    newTab: true,
    tags: [partnerNodesTag, imageToVideoTag, bRollTag]
  },
  {
    id: 'ad_ooh_visualization',
    publishedDate: '2026-07-20',
    slug: 'ooh-visualization',
    category: 'ads',
    title: { en: 'OOH Visualization', 'zh-CN': '户外广告可视化' },
    description: {
      en: 'Place a poster into real-world outdoor ad spots with this ComfyUI workflow — auto-generate billboard, transit, and building-wrap mockups with Gemini Image 2.',
      'zh-CN':
        '用此 ComfyUI 工作流将海报置入真实的户外广告场景——通过 Gemini Image 2 自动生成广告牌、公交站台和楼体包装样机。'
    },
    videoSrc: 'https://media.comfy.org/website/learning/advertising6.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising6-thumb.png',
    href: 'https://cloud.comfy.org/?share=9e36b66e188b',
    newTab: true,
    tags: [partnerNodesTag, imageGenerationTag, outOfHomeTag]
  }
] as const

/** The curated global featured pick, shown wherever its category is in scope. */
const FEATURED_ID = 'skyreplacement_smaller_v06'

export const filterByCategory = (
  category?: LearningCategory
): readonly LearningTutorial[] =>
  category
    ? learningTutorials.filter((tutorial) => tutorial.category === category)
    : learningTutorials

/**
 * Categories that actually have tutorials, in nav order. Drives both the
 * sidebar nav and the /learning/[slug] routes, so empty categories are neither
 * shown nor generated.
 */
export const populatedCategories: readonly LearningCategory[] =
  learningCategories.filter((category) => filterByCategory(category).length > 0)

/**
 * Featured item for a page — the global pick when visible, else the category's
 * first. Undefined when the category has no tutorials yet.
 */
export const featuredFor = (
  category?: LearningCategory
): LearningTutorial | undefined => {
  const pool = filterByCategory(category)
  return pool.find((tutorial) => tutorial.id === FEATURED_ID) ?? pool[0]
}

export const getTutorialByCategoryAndSlug = (
  category: string,
  slug: string
): LearningTutorial | undefined =>
  learningTutorials.find(
    (tutorial) => tutorial.category === category && tutorial.slug === slug
  )

/** Canonical path for a category's directory page (wrap with localizeHref for zh-CN). */
export const categoryPath = (category: LearningCategory): string =>
  `/learning/${category}`

/** Canonical path for a tutorial's detail page (wrap with localizeHref for zh-CN). */
export const tutorialPath = (tutorial: LearningTutorial): string =>
  `${categoryPath(tutorial.category)}/${tutorial.slug}`

export interface LearningCrumb {
  name: string
  path: string
}

/**
 * Breadcrumb trail for learning pages: Home → Learning (→ category).
 * Feeds the BreadcrumbList JSON-LD on directory and tutorial pages.
 */
export const learningCrumbs = (
  locale: Locale,
  category?: LearningCategory
): LearningCrumb[] => [
  { name: t('breadcrumb.home', locale), path: '/' },
  { name: t('learning.title', locale), path: '/learning' },
  ...(category
    ? [
        {
          name: t(categoryLabelKeys[category], locale),
          path: categoryPath(category)
        }
      ]
    : [])
]

/** Authored description when present, otherwise a per-locale SEO template. */
export const tutorialDescription = (
  tutorial: LearningTutorial,
  locale: Locale
): string => {
  if (tutorial.description) return tutorial.description[locale]
  const title = tutorial.title[locale]
  const label = t(categoryLabelKeys[tutorial.category], locale)
  return locale === 'zh-CN'
    ? `观看《${title}》教程——一个可亲自体验的 ComfyUI ${label} 实战工作流。`
    : `Watch the ${title} tutorial — a hands-on ComfyUI ${label} workflow you can try yourself.`
}
