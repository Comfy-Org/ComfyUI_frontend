import { getModelBySlug } from '../../../config/models'
import { ltxPage } from '../../../data/ltx'
import { minimaxPage } from '../../../data/minimax'
import { minimaxMusic3Page } from '../../../data/minimaxMusic3'
import { seedancePage } from '../../../data/seedance'
import { wanAnimate2Page } from '../../../data/wanAnimate2'

export type ModelMediaTone = 'forest' | 'plum' | 'ember' | 'canvas'
export type ExploreModelStatus = 'day-zero' | 'open-weights'
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
  mediaTone: ModelMediaTone
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
    href: 'https://blog.comfy.org/p/wan26-reference-to-video',
    target: '_blank',
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
    statuses: ['day-zero'],
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
    statuses: ['day-zero', 'open-weights'],
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
    statuses: ['day-zero', 'open-weights'],
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
    statuses: ['day-zero'],
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
    mediaTone: 'plum'
  },
  {
    title: 'AI image generator',
    description: 'Flux, Qwen Image, SDXL, and Z-Image directed from one graph.',
    meta: '22 models',
    mediaTone: 'ember'
  },
  {
    title: 'Image to video',
    description: 'Animate any still with motion you control, frame by frame.',
    meta: '12 models',
    mediaTone: 'forest'
  },
  {
    title: 'AI upscaler',
    description: 'Detail without artifacts. 4K and beyond, batch-ready.',
    meta: '8 models',
    mediaTone: 'canvas'
  },
  {
    title: 'AI face swap',
    description: 'Identity held across shots, edits, and angles.',
    meta: '6 workflows',
    mediaTone: 'forest'
  },
  {
    title: 'Speech + music',
    description: 'Voices, tracks, and sound design with structure you direct.',
    meta: '9 models',
    mediaTone: 'canvas'
  },
  {
    title: '3D generation',
    description: 'Image to textured mesh, ready for your pipeline.',
    meta: '5 models',
    mediaTone: 'plum'
  },
  {
    title: 'Train a LoRA',
    description: 'Your style, your dataset, your checkpoint. Full control.',
    meta: 'Training guide',
    mediaTone: 'ember'
  }
]

export const familyVariantFixtures: ExploreFamilyVariant[] = [
  {
    name: 'Wan 2.6',
    description: 'Text and image to video with native audio.',
    meta: '1.8M runs',
    href: 'https://blog.comfy.org/p/wan26-reference-to-video'
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
