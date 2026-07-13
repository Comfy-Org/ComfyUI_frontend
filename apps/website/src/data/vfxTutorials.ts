import type { Tutorial } from '../components/common/TutorialCard.vue'
import type { TranslationKey } from '../i18n/translations'

const partnerNodesTag: TranslationKey = 'tags.partnerNodes'
const imageToVideoTag: TranslationKey = 'tags.imageToVideo'

const dougHoman: Tutorial['author'] = {
  name: 'Doug Homan',
  avatarSrc: 'https://media.comfy.org/website/authors/doug-hogan.jpeg'
}

export const vfxTutorials: readonly Tutorial[] = [
  {
    id: 'skyreplacement_smaller_v06',
    title: { en: 'Sky Replacement', 'zh-CN': '天空替换' },
    videoSrc:
      'https://media.comfy.org/website/vfx/skyreplacement_smaller_v06.mp4',
    poster:
      'https://media.comfy.org/website/vfx/skyreplacement_smaller_v06_thumbnail.jpg',
    href: 'https://comfy.org/workflows/537cf7f1f745-537cf7f1f745/',
    caption: [
      {
        src: 'https://media.comfy.org/website/vfx/skyreplacement_smaller_v06_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag],
    author: dougHoman
  },
  {
    id: 'cleanplate_walkthrough_v03',
    title: { en: 'Cleanplate Walkthrough', 'zh-CN': '净板演练' },
    videoSrc:
      'https://media.comfy.org/website/vfx/cleanplate_walkthrough_v03.mp4',
    poster:
      'https://media.comfy.org/website/vfx/cleanplate_walkthrough_v03_thumbnail.jpg',
    caption: [
      {
        src: 'https://media.comfy.org/website/vfx/cleanplate_walkthrough_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    href: 'https://comfy.org/workflows/8f2cf0df5da6-8f2cf0df5da6/',
    tags: [partnerNodesTag, imageToVideoTag],
    author: dougHoman
  },
  {
    id: 'deaging_workflow_v03',
    title: { en: 'Deaging Workflow', 'zh-CN': '减龄工作流' },
    videoSrc: 'https://media.comfy.org/website/vfx/deaging_workflow_v03.mp4',
    poster:
      'https://media.comfy.org/website/vfx/deaging_workflow_v03_thumbnail.jpg',
    href: 'https://comfy.org/workflows/93f286fbc2c8-93f286fbc2c8/',
    caption: [
      {
        src: 'https://media.comfy.org/website/vfx/deaging_workflow_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag],
    author: dougHoman
  },
  {
    id: 'frame_adjustments_demo_v03',
    title: { en: 'Frame Adjustments Demo', 'zh-CN': '帧调整演示' },
    videoSrc:
      'https://media.comfy.org/website/vfx/frame_adjustments_demo_v03.mp4',
    poster:
      'https://media.comfy.org/website/vfx/frame_adjustments_demo_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=7dca0438edf4',
    caption: [
      {
        src: 'https://media.comfy.org/website/vfx/frame_adjustments_demo_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag],
    author: dougHoman
  },
  {
    id: 'mattes_and_utilities_v03',
    title: { en: 'Mattes and Utilities', 'zh-CN': '遮罩与实用工具' },
    videoSrc:
      'https://media.comfy.org/website/vfx/mattes_and_utilities_v03.mp4',
    poster:
      'https://media.comfy.org/website/vfx/mattes_and_utilities_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=be0889296f65',
    caption: [
      {
        src: 'https://media.comfy.org/website/vfx/mattes_and_utilities_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag],
    author: dougHoman
  },
  {
    id: 'seedance_demo_comfyui_v03',
    title: {
      en: 'Seedance Demo (ComfyUI)',
      'zh-CN': 'Seedance 演示（ComfyUI）'
    },
    videoSrc:
      'https://media.comfy.org/website/vfx/seedance_demo_comfyui_v03.mp4',
    poster:
      'https://media.comfy.org/website/vfx/seedance seedance_demo_comfyui_v03_thumbnail.jpg',
    href: 'https://cloud.comfy.org/?share=ef543bd4a773',
    caption: [
      {
        src: 'https://media.comfy.org/website/vfx/seedance_demo_comfyui_v03_vtt.en.vtt',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ],
    tags: [partnerNodesTag, imageToVideoTag],
    author: dougHoman
  }
] as const
