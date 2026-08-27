import { getModelBySlug } from '../../../config/models'
import { ltxPage } from '../../../data/ltx'
import { minimaxPage } from '../../../data/minimax'
import { minimaxMusic3Page } from '../../../data/minimaxMusic3'
import { seedancePage } from '../../../data/seedance'
import { wanAnimate2Page } from '../../../data/wanAnimate2'
import { wan3Page } from '../../../data/wan3'
import type { TranslationKey } from '../../../i18n/translations'

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

export interface ExploreModelFamilyFixture {
  id: string
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  mediaSrc: string
  href: string
  variants: readonly string[]
}

export interface ExploreFeaturedRelease {
  name: string
  description: string
  href: string
  mediaSrc: string
  publisher: string
  brandIconSrc: string
  tags: readonly string[]
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
    title: 'AI interior design',
    description:
      'Redesign rooms from a photo while preserving their real layout.',
    meta: 'Browse workflows',
    href: 'https://comfy.org/workflows/use-cases/ai-interior-design/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/a4700cc0-72ea-409e-9693-34a6d26a8c96.webp'
  },
  {
    title: 'AI image & video upscaler',
    description:
      'Increase resolution while preserving natural detail and texture.',
    meta: 'Browse workflows',
    href: 'https://comfy.org/workflows/use-cases/ai-image-upscaler/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/24a6cdaf-2f22-47a0-b61c-bbeda152fbf8.png'
  },
  {
    title: 'AI image to video',
    description:
      'Animate still images with controllable motion using leading video models.',
    meta: 'Browse workflows',
    href: 'https://comfy.org/workflows/use-cases/ai-image-to-video/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/4c49ebf0-53fb-488e-a224-a26a32affb15.webp'
  },
  {
    title: 'Restore old photos',
    description:
      'Repair damage, recover faces, colorize prints, and upscale scans.',
    meta: 'Browse workflows',
    href: 'https://comfy.org/workflows/use-cases/restore-old-photos/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/afaf876d-ffe1-4f6d-94a9-3bd4c581a921.png'
  },
  {
    title: 'AI anime generator',
    description:
      'Create anime characters and scenes from text with open models.',
    meta: 'Browse workflows',
    href: 'https://comfy.org/workflows/use-cases/ai-anime-generator/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/19f8bb4b-9547-4d33-aeab-70b4f72a1c39.png'
  },
  {
    title: 'AI song generator',
    description:
      'Generate complete songs with vocals from prompts or your own lyrics.',
    meta: 'Browse workflows',
    href: 'https://comfy.org/workflows/use-cases/ai-song-generator/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/470ff978-7fed-4d05-bf06-0de76d7396c6.png'
  },
  {
    title: 'AI music generator',
    description:
      'Generate instrumental music, loops, and sound effects from text.',
    meta: 'Browse workflows',
    href: 'https://comfy.org/workflows/use-cases/ai-music-generator/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/597d9b7b-cf55-417d-b1ea-cb3710b0a840.png'
  },
  {
    title: 'AI hairstyle changer',
    description:
      'Preview new hairstyles from a portrait while preserving identity.',
    meta: 'Browse workflows',
    href: 'https://comfy.org/workflows/use-cases/ai-hairstyle-changer/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/9c8e4eb5-e3d1-438a-bcdf-c32d9e66642f.png'
  }
]

export const latestModelReleaseFixture: ExploreFeaturedRelease = {
  name: 'Wan 3.0',
  description: 'Up to 30-second video with native audio and references.',
  href: '/wan-3.0',
  mediaSrc: requiredMediaSource('Wan 3.0', wan3Page.hero.posterSrc),
  publisher: 'Alibaba',
  brandIconSrc: '/icons/ai-models/wan.svg',
  tags: ['Partner Nodes', 'Text to video', 'Image to video']
}

export const modelFamilyFixtures: ExploreModelFamilyFixture[] = [
  {
    id: 'wan',
    titleKey: 'models.explore.family.wan.title',
    descriptionKey: 'models.explore.family.wan.description',
    mediaSrc: latestModelReleaseFixture.mediaSrc,
    href: latestModelReleaseFixture.href,
    variants: ['Wan 3.0', 'Wan 2.5', 'Wan Animate 2']
  },
  {
    id: 'minimax',
    titleKey: 'models.explore.family.minimax.title',
    descriptionKey: 'models.explore.family.minimax.description',
    mediaSrc: requiredMediaSource('MiniMax H3', minimaxPage.hero.posterSrc),
    href: '/minimax-h3',
    variants: ['MiniMax H3', 'MiniMax Music 3']
  },
  {
    id: 'seedance',
    titleKey: 'models.explore.family.seedance.title',
    descriptionKey: 'models.explore.family.seedance.description',
    mediaSrc: requiredMediaSource('Seedance 2.5', seedancePage.hero.posterSrc),
    href: '/seedance-2.5',
    variants: ['Seedance 2.5', 'Text to video', 'Multi-reference']
  }
]
