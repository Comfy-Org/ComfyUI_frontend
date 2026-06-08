import type {
  Locale,
  LocalizedText,
  TranslationKey
} from '../i18n/translations'
import type { VideoTrack } from '../types/video'

export interface LearningTutorial {
  id: string
  tags: readonly TranslationKey[]
  title: LocalizedText
  videoSrc: string
  href?: string
  poster?: string
  posterTime?: number
  tracks?: readonly VideoTrack[]
}

const DEFAULT_POSTER_TIME_SECONDS = 1

const partnerNodesTag: TranslationKey = 'tags.partnerNodes'
const imageToVideoTag: TranslationKey = 'tags.imageToVideo'

export const getTutorialPosterSrc = (tutorial: LearningTutorial): string =>
  tutorial.poster
    ? tutorial.poster
    : `${tutorial.videoSrc}#t=${tutorial.posterTime ?? DEFAULT_POSTER_TIME_SECONDS}`

const SUBTITLE_LABELS: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '简体中文'
}

const subtitleTrack = (src: string, locale: Locale): VideoTrack => ({
  src,
  kind: 'subtitles',
  srclang: locale,
  label: SUBTITLE_LABELS[locale]
})

export const learningTutorials: readonly LearningTutorial[] = [
  {
    id: 'cleanplate_walkthrough_v03',
    title: { en: 'Cleanplate Walkthrough', 'zh-CN': '净板演练' },
    videoSrc:
      'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg',
    // href: '#',
    tags: [partnerNodesTag, imageToVideoTag],
    tracks: [
      subtitleTrack(
        'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_vtt.en.vtt',
        'en'
      )
    ]
  },
  {
    id: 'deaging_workflow_v03',
    title: { en: 'Deaging Workflow', 'zh-CN': '减龄工作流' },
    videoSrc:
      'https://media.comfy.org/website/learning/deaging_workflow_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/deaging_workflow_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=93f286fbc2c8',
    tags: [partnerNodesTag, imageToVideoTag],
    tracks: [
      subtitleTrack(
        'https://media.comfy.org/website/learning/deaging_workflow_v03_vtt.en.vtt',
        'en'
      )
    ]
  },
  {
    id: 'frame_adjustments_demo_v03',
    title: { en: 'Frame Adjustments Demo', 'zh-CN': '帧调整演示' },
    videoSrc:
      'https://media.comfy.org/website/learning/frame_adjustments_demo_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/frame_adjustments_demo_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=7dca0438edf4',
    tags: [partnerNodesTag, imageToVideoTag],
    tracks: [
      subtitleTrack(
        'https://media.comfy.org/website/learning/frame_adjustments_demo_v03_vtt.en.vtt',
        'en'
      )
    ]
  },
  {
    id: 'mattes_and_utilities_v03',
    title: { en: 'Mattes and Utilities', 'zh-CN': '遮罩与实用工具' },
    videoSrc:
      'https://media.comfy.org/website/learning/mattes_and_utilities_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/mattes_and_utilities_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=be0889296f65',
    tags: [partnerNodesTag, imageToVideoTag],
    tracks: [
      subtitleTrack(
        'https://media.comfy.org/website/learning/mattes_and_utilities_v03_vtt.en.vtt',
        'en'
      )
    ]
  },
  {
    id: 'seedance_demo_comfyui_v03',
    title: { en: 'Seedance Demo ComfyUI', 'zh-CN': 'Seedance ComfyUI 演示' },
    videoSrc:
      'https://media.comfy.org/website/learning/seedance_demo_comfyui_v03.mp4',
    poster:
      'https://media.comfy.org/website/learning/seedance seedance_demo_comfyui_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=ef543bd4a773',
    tags: [partnerNodesTag, imageToVideoTag],
    tracks: [
      subtitleTrack(
        'https://media.comfy.org/website/learning/seedance_demo_comfyui_v03_vtt.en.vtt',
        'en'
      )
    ]
  },
  {
    id: 'skyreplacement_smaller_v06',
    title: { en: 'Sky Replacement', 'zh-CN': '天空替换' },
    videoSrc:
      'https://media.comfy.org/website/learning/skyreplacement_smaller_v06.mp4',
    poster:
      'https://media.comfy.org/website/learning/skyreplacement_smaller_v06_thumbnail.jpg',
    href: 'https://comfy.org/workflows/537cf7f1f745-537cf7f1f745/',
    tags: [partnerNodesTag, imageToVideoTag],
    tracks: [
      subtitleTrack(
        'https://media.comfy.org/website/learning/skyreplacement_smaller_v06_vtt.en.vtt',
        'en'
      )
    ]
  }
] as const
