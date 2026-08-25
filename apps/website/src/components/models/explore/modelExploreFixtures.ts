import { getModelBySlug } from '../../../config/models'
import { ltxPage } from '../../../data/ltx'
import { minimaxPage } from '../../../data/minimax'
import { minimaxMusic3Page } from '../../../data/minimaxMusic3'
import { seedancePage } from '../../../data/seedance'
import { wanAnimate2Page } from '../../../data/wanAnimate2'

export type ModelMediaTone = 'forest' | 'plum' | 'ember' | 'canvas'
export type ExploreModelStatus = 'open-weights'
type ExploreModelMedia =
  | { type: 'image'; src: string }
  | { type: 'placeholder'; tone: ModelMediaTone }

export interface ExploreModelCardFixture {
  name: string
  description: string
  href: string
  target: '_self' | '_blank'
  modality: string
  tag: string
  statuses?: readonly ExploreModelStatus[]
  media: ExploreModelMedia
}

export interface ExploreTaskFixture {
  title: string
  description: string
  meta: string
  href: string
  mediaSrc: string
}

export interface ExploreFamilyVariant {
  name: string
  description: string
  meta: string
  href: string
}

function requiredMediaSource(owner: string, src: string | undefined): string {
  if (!src) throw new Error(`Missing approved media source for ${owner}`)
  return src
}

const qwenImageEdit = getModelBySlug('qwen-image-edit-2511-bf16')

export const trendingModelFixtures: ExploreModelCardFixture[] = [
  {
    name: 'Flux 3',
    href: '/flux-3',
    target: '_self',
    description:
      'Frontier video generation. Animate a still frame into coherent, natural motion.',
    modality: 'Image to video',
    tag: 'Lipsync',
    media: { type: 'placeholder', tone: 'forest' }
  },
  {
    name: 'Wan 2.6',
    href: '/p/supported-models/wan-2-6',
    target: '_self',
    description:
      'Open-weights video with native audio. Full graph control, LoRA-ready.',
    modality: 'Text to video',
    tag: 'Open weights',
    statuses: ['open-weights'],
    media: { type: 'placeholder', tone: 'plum' }
  },
  {
    name: 'Qwen Image Edit',
    href: '/p/supported-models/qwen-image-edit-2511-bf16',
    target: '_self',
    description:
      'Instruction-based image editing that holds identity across edits.',
    modality: 'Image edit',
    tag: 'Open weights',
    statuses: ['open-weights'],
    media: {
      type: 'image',
      src: requiredMediaSource(
        'Qwen Image Edit 2511 BF16',
        qwenImageEdit?.thumbnailUrl
      )
    }
  },
  {
    name: 'Seedance 2.5',
    href: '/seedance-2.5',
    target: '_self',
    description:
      'Native 30-second single-shot video at 720p, from text or reference frames.',
    modality: 'Text to video',
    tag: 'Multi-ref',
    media: {
      type: 'image',
      src: requiredMediaSource('Seedance 2.5', seedancePage.hero.posterSrc)
    }
  }
]

export const dayZeroModelFixtures: ExploreModelCardFixture[] = [
  {
    name: 'MiniMax H3',
    href: '/minimax-h3',
    target: '_self',
    description:
      'Image-to-video with strong physics and character hold across shots.',
    modality: 'Image to video',
    tag: 'Partner API',
    media: {
      type: 'image',
      src: requiredMediaSource('MiniMax H3', minimaxPage.hero.posterSrc)
    }
  },
  {
    name: 'Wan Animate 2',
    href: '/wan-animate-2',
    target: '_self',
    description:
      'Character animation from a single reference. Open weights, day zero.',
    modality: 'Image to video',
    tag: 'Open weights',
    statuses: ['open-weights'],
    media: {
      type: 'image',
      src: requiredMediaSource('Wan Animate 2', wanAnimate2Page.hero.posterSrc)
    }
  },
  {
    name: 'LTX 2.5',
    href: '/ltx-2.5',
    target: '_self',
    description:
      'Fast iteration video. Draft loops in seconds, refine on the same seed.',
    modality: 'Text to video',
    tag: 'Open weights',
    statuses: ['open-weights'],
    media: {
      type: 'image',
      src: requiredMediaSource('LTX 2.5', ltxPage.hero.posterSrc)
    }
  },
  {
    name: 'MiniMax Music 3',
    href: '/minimax-music-3',
    target: '_self',
    description:
      'Complete songs with structure — verse, chorus, and a mix you can direct.',
    modality: 'Text to audio',
    tag: 'Partner API',
    media: {
      type: 'image',
      src: requiredMediaSource(
        'MiniMax Music 3',
        minimaxMusic3Page.hero.posterSrc
      )
    }
  }
]

export const taskFixtures: ExploreTaskFixture[] = [
  {
    title: 'AI video generator',
    description:
      'Every video model, one canvas. Kling, Wan, Veo, and Seedance.',
    meta: '14 models',
    href: 'https://comfy.org/workflows/use-cases/ai-image-to-video/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/4c49ebf0-53fb-488e-a224-a26a32affb15.webp'
  },
  {
    title: 'AI image generator',
    description: 'Flux, Qwen Image, SDXL, and Z-Image directed from one graph.',
    meta: '22 models',
    href: 'https://comfy.org/workflows/tag/text-to-image/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/2f4618ff-314a-4a08-b60f-589d93ffb487.png'
  },
  {
    title: 'Image to video',
    description: 'Animate any still with motion you control, frame by frame.',
    meta: '12 models',
    href: 'https://comfy.org/workflows/use-cases/ai-image-to-video/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/0959c97d-aef3-405e-9369-3d1b73d71c52.webp'
  },
  {
    title: 'AI upscaler',
    description: 'Detail without artifacts. 4K and beyond, batch-ready.',
    meta: '8 models',
    href: 'https://comfy.org/workflows/use-cases/ai-image-upscaler/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/24a6cdaf-2f22-47a0-b61c-bbeda152fbf8.png'
  },
  {
    title: 'AI face swap',
    description: 'Identity held across shots, edits, and angles.',
    meta: '6 workflows',
    href: 'https://comfy.org/workflows/use-cases/ai-character-replacement/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/4776f83f-5307-4539-8196-ff5a585ef8f8.webp'
  },
  {
    title: 'Speech + music',
    description: 'Voices, tracks, and sound design with structure you direct.',
    meta: '9 models',
    href: 'https://comfy.org/workflows/use-cases/ai-music-generator/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/717725cf-d086-4ed3-91b6-9d57933bd58c.webp'
  },
  {
    title: '3D generation',
    description: 'Image to textured mesh, ready for your pipeline.',
    meta: '5 models',
    href: 'https://comfy.org/workflows/use-cases/image-to-3d/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/405635b3-6e57-44f5-bbbe-7440381c021d.png'
  },
  {
    title: 'Train a LoRA',
    description: 'Your style, your dataset, your checkpoint. Full control.',
    meta: 'Training guide',
    href: 'https://comfy.org/workflows/tag/lora/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/d0ad5bf1-699f-4578-9c32-9e9ef6f99d14.png'
  }
]

export const familyVariantFixtures: ExploreFamilyVariant[] = [
  {
    name: 'Wan 2.6',
    description: 'Text and image to video with native audio.',
    meta: '1.8M runs',
    href: '/p/supported-models/wan-2-6'
  },
  {
    name: 'Wan 2.5',
    description: 'A proven production baseline.',
    meta: '3.1M runs',
    href: 'https://blog.comfy.org/p/wan-25-preview-api-nodes-in-comfyui'
  },
  {
    name: 'Wan Animate 2',
    description: 'Character animation from one reference.',
    meta: '420k runs',
    href: '/wan-animate-2'
  }
]
