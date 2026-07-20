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
  poster?: string
  caption?: readonly VideoTrack[]
  posterTime?: number
  /** ISO date; feeds VideoObject.uploadDate. Falls back to the launch date. */
  publishedDate?: string
}

/** Fallback VideoObject.uploadDate when a tutorial has no explicit date. */
export const LEARNING_DEFAULT_PUBLISHED_DATE = '2026-07-01'

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

const DEFAULT_POSTER_TIME_SECONDS = 1

const partnerNodesTag: TranslationKey = 'tags.partnerNodes'
const imageToVideoTag: TranslationKey = 'tags.imageToVideo'

export const getTutorialPosterSrc = (tutorial: LearningTutorial): string =>
  tutorial.poster
    ? tutorial.poster
    : `${tutorial.videoSrc}#t=${tutorial.posterTime ?? DEFAULT_POSTER_TIME_SECONDS}`

export const learningTutorials: readonly LearningTutorial[] = [
  {
    id: 'cleanplate_walkthrough_v03',
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
    slug: 'frame-adjustments',
    category: 'vfx',
    title: { en: 'Frame Adjustments Demo', 'zh-CN': '帧调整演示' },
    videoSrc:
      'https://media.comfy.org/website/learning/frame_adjustments_demo_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/frame_adjustments_demo_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=7dca0438edf4',
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
    slug: 'mattes-and-utilities',
    category: 'vfx',
    title: { en: 'Mattes and Utilities', 'zh-CN': '遮罩与实用工具' },
    videoSrc:
      'https://media.comfy.org/website/learning/mattes_and_utilities_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/mattes_and_utilities_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=be0889296f65',
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
    slug: 'seedance-demo',
    category: 'vfx',
    title: { en: 'Seedance Demo ComfyUI', 'zh-CN': 'Seedance ComfyUI 演示' },
    videoSrc:
      'https://media.comfy.org/website/learning/seedance_demo_comfyui_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/seedance seedance_demo_comfyui_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=ef543bd4a773',
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
    slug: 'character-sheet',
    category: 'animations',
    title: { en: 'Character Sheet', 'zh-CN': '角色设定表' },
    videoSrc: 'https://media.comfy.org/website/learning/animation1.mp4',
    poster: 'https://media.comfy.org/website/learning/animation1-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=d8414beacf91',
    tags: []
  },
  {
    id: 'animation_keyframe_exploration',
    slug: 'keyframe-exploration',
    category: 'animations',
    title: { en: 'Keyframe Exploration', 'zh-CN': '关键帧探索' },
    videoSrc: 'https://media.comfy.org/website/learning/animation2.mp4',
    poster: 'https://media.comfy.org/website/learning/animation2-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=78a07a3ce040',
    tags: []
  },
  {
    id: 'animation_background_and_asset_generation',
    slug: 'background-and-asset-generation',
    category: 'animations',
    title: { en: 'Background and Asset Generation', 'zh-CN': '背景与素材生成' },
    videoSrc: 'https://media.comfy.org/website/learning/animation3.mp4',
    poster: 'https://media.comfy.org/website/learning/animation3-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=1d905d914f11',
    tags: []
  },
  {
    id: 'animation_concept_exploration',
    slug: 'concept-exploration',
    category: 'animations',
    title: { en: 'Concept Exploration', 'zh-CN': '概念探索' },
    videoSrc: 'https://media.comfy.org/website/learning/animation4.mp4',
    poster: 'https://media.comfy.org/website/learning/animation4-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=098f35ab854f',
    tags: []
  },
  {
    id: 'animation_in_betweening',
    slug: 'in-betweening',
    category: 'animations',
    title: { en: 'In-Betweening', 'zh-CN': '中间帧绘制' },
    videoSrc: 'https://media.comfy.org/website/learning/animation5.mp4',
    poster: 'https://media.comfy.org/website/learning/animation5-thumb.jpg',
    href: 'https://cloud.comfy.org/?share=7e6419542193',
    tags: []
  },
  {
    id: 'animation_background_and_compositing',
    slug: 'background-and-compositing',
    category: 'animations',
    title: { en: 'Background and Compositing', 'zh-CN': '背景与合成' },
    videoSrc: 'https://media.comfy.org/website/learning/animation6.mp4',
    poster: 'https://media.comfy.org/website/learning/animation6-thumb.jpg',
    tags: []
  },
  {
    id: 'ad_moodboard_creation',
    slug: 'moodboard-creation',
    category: 'ads',
    title: { en: 'Moodboard Creation', 'zh-CN': '情绪板制作' },
    videoSrc: 'https://media.comfy.org/website/learning/advertising1.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising1-thumb.png',
    href: 'https://cloud.comfy.org/?share=62f892c540e3',
    tags: []
  },
  {
    id: 'ad_storyboard_creation',
    slug: 'storyboard-creation',
    category: 'ads',
    title: { en: 'Storyboard Creation', 'zh-CN': '故事板制作' },
    videoSrc: 'https://media.comfy.org/website/learning/advertising2.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising2-thumb.png',
    href: 'https://cloud.comfy.org/?share=a598339548b3',
    tags: []
  },
  {
    id: 'ad_product_photography',
    slug: 'product-photography',
    category: 'ads',
    title: { en: 'Product Photography', 'zh-CN': '产品摄影' },
    videoSrc: 'https://media.comfy.org/website/learning/advertising3.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising3-thumb.png',
    href: 'https://cloud.comfy.org/?share=2d5b0cdf915a',
    tags: []
  },
  {
    id: 'ad_talent_casting',
    slug: 'talent-casting',
    category: 'ads',
    title: { en: 'Talent Casting', 'zh-CN': '演员选角' },
    videoSrc: 'https://media.comfy.org/website/learning/advertising4.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising4-thumb.png',
    href: 'https://cloud.comfy.org/?share=1233f85f1c96',
    tags: []
  },
  {
    id: 'ad_broll_creation',
    slug: 'b-roll-creation',
    category: 'ads',
    title: { en: 'B-Roll Creation', 'zh-CN': 'B-Roll 素材制作' },
    videoSrc: 'https://media.comfy.org/website/learning/advertising5.mp4',
    poster: 'https://media.comfy.org/website/learning/advertising5-thumb.png',
    href: 'https://cloud.comfy.org/?share=dd1946bdd7c8',
    tags: []
  },
  {
    id: 'ad_ooh_visualization',
    slug: 'ooh-visualization',
    category: 'ads',
    title: { en: 'OOH Visualization', 'zh-CN': '户外广告可视化' },
    videoSrc: 'https://media.comfy.org/website/learning/advertising6.mp4',
    href: 'https://cloud.comfy.org/?share=9e36b66e188b',
    tags: []
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

/** Canonical path for a tutorial's detail page (wrap with localizeHref for zh-CN). */
export const tutorialPath = (tutorial: LearningTutorial): string =>
  `/learning/${tutorial.category}/${tutorial.slug}`

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
