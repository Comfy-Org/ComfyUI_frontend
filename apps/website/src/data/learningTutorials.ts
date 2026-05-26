import type { LocalizedText, TranslationKey } from '../i18n/translations'

export interface LearningTutorial {
  id: string
  title: LocalizedText
  videoSrc: string
  poster?: string
  href: string
  tags: readonly TranslationKey[]
}

const partnerNodesTag: TranslationKey = 'tags.partnerNodes'
const imageToVideoTag: TranslationKey = 'tags.imageToVideo'

export const learningTutorials: readonly LearningTutorial[] = [
  {
    id: 'cleanplate_walkthrough_v03',
    title: { en: 'Title here', 'zh-CN': '标题占位' },
    videoSrc:
      'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03.mp4',
    href: '#',
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'deaging_workflow_v03',
    title: { en: 'Title here', 'zh-CN': '标题占位' },
    videoSrc:
      'https://media.comfy.org/website/learning/deaging_workflow_v03.mp4',
    href: '#',
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'frame_adjustments_demo_v03',
    title: { en: 'Title here', 'zh-CN': '标题占位' },
    videoSrc:
      'https://media.comfy.org/website/learning/frame_adjustments_demo_v03.mp4',
    href: '#',
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'mattes_and_utilities_v03',
    title: { en: 'Title here', 'zh-CN': '标题占位' },
    videoSrc:
      'https://media.comfy.org/website/learning/mattes_and_utilities_v03.mp4',
    href: '#',
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'seedance_demo_comfyui_v03',
    title: { en: 'Title here', 'zh-CN': '标题占位' },
    videoSrc:
      'https://media.comfy.org/website/learning/seedance_demo_comfyui_v03.mp4',
    href: '#',
    tags: [partnerNodesTag, imageToVideoTag]
  },
  {
    id: 'skyreplacement_smaller_v06',
    title: { en: 'Title here', 'zh-CN': '标题占位' },
    videoSrc:
      'https://media.comfy.org/website/learning/skyreplacement_smaller_v06.mp4',
    href: '#',
    tags: [partnerNodesTag, imageToVideoTag]
  }
] as const
