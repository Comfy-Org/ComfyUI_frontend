import { sortWorkshopModels } from '../../../config/models-catalogue'
import { workshopModels } from '../../../config/workshop-browse-content'
import { taskLabelFor } from '../../../lib/workshop/task-label'
import { models } from '../../../config/models'
import type { TranslationKey } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import trendSnapshot from '../../../data/model-trends.snapshot.json'
import { modelTrendSnapshotSchema, rankModelTrends } from './modelTrends'
import { latestVerifiedModelVersions } from './modelVersionReleases'

export type ModelMediaTone = 'forest' | 'plum' | 'ember' | 'canvas'
export type ExploreModelStatus = 'open-weights'
type ExploreModelMedia =
  | { type: 'image'; src: string }
  | { type: 'placeholder'; tone: ModelMediaTone }

export interface ExploreModelCardFixture {
  taskLabel?: string
  capabilities?: readonly string[]
  provider?: string
  name: string
  description: string
  href: string
  target: '_self' | '_blank'
  modality: string
  tag: string
  statuses?: readonly ExploreModelStatus[]
  media: ExploreModelMedia
  releasedAt?: string
  supportedAt?: string
  sourceUrl?: string
}

export interface ExploreTaskFixture {
  title: string
  description: string
  workflowCount: number
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
  provider: string
  taskLabel?: string
  capabilities?: readonly string[]
  statuses?: readonly ExploreModelStatus[]
  name: string
  description: string
  href: string
  mediaSrc: string
  publisher: string
  brandIconSrc: string
  tags: readonly string[]
}

const canonicalModels = models.filter((model) => !model.canonicalSlug)
const illustratedModels = canonicalModels.filter(
  (model) =>
    model.thumbnailUrl &&
    ['diffusion_models', 'checkpoints', 'partner_nodes'].includes(
      model.directory
    )
)

function hubTags(href: string) {
  const model = workshopModels.find((model) => model.href === href)
  const catalogModel = canonicalModels.find(
    (model) => href === `/p/supported-models/${model.slug}/`
  )
  return model
    ? { taskLabel: taskLabelFor(model, 'en'), capabilities: model.capabilities }
    : catalogModel
      ? {
          taskLabel: t('workshop.task.label', 'en', {
            input: t('workshop.task.text', 'en'),
            output: t('workshop.filter.image', 'en')
          }),
          capabilities: (catalogModel.categories ?? []).filter(
            (category) => category !== 'image'
          )
        }
      : {}
}

const validatedTrendSnapshot = modelTrendSnapshotSchema.parse(trendSnapshot)

// Fixture builds (e2e) pin the clock to the snapshot so its age never changes
// which cards render. Production builds always judge age against today.
const trendReferenceTime =
  process.env.WEBSITE_MODEL_TRENDS_PIN_SNAPSHOT_TIME === '1'
    ? new Date(validatedTrendSnapshot.asOf)
    : new Date()

export const measuredTrendingModelFixtures: ExploreModelCardFixture[] =
  rankModelTrends(validatedTrendSnapshot, trendReferenceTime).map((model) => ({
    name: model.name,
    provider: model.provider,
    description: t(model.descriptionKey, 'en'),
    href: model.href,
    ...hubTags(model.href),
    target: model.href.startsWith('https:') ? '_blank' : '_self',
    modality: model.modality,
    tag: 'Partner API',
    media: model.mediaSrc
      ? { type: 'image', src: model.mediaSrc }
      : { type: 'placeholder', tone: 'canvas' }
  }))

const audioDescriptions: Readonly<Record<string, string>> = {
  'acestep-v1-5-turbo':
    'Generate music and songs from text prompts with fast audio generation.',
  'ace-step-v1-3-5b':
    'Create music with vocals and instruments from text and lyrics.',
  'yue2-3b-int8-convrot':
    'Generate songs with vocals and instrumental accompaniment from lyrics.',
  'acestep-v1-5-xl-base-bf16':
    'Generate music and vocals from text with the ACE-Step XL base model.',
  'acestep-v1-5-xl-sft-bf16':
    'Create music and songs with the fine-tuned ACE-Step XL model.',
  'acestep-v1-5-xl-turbo-bf16':
    'Generate music quickly with the ACE-Step XL turbo model.'
}
const openAudioModels: ExploreModelCardFixture[] = canonicalModels.flatMap(
  (model) => {
    const description = audioDescriptions[model.slug]
    if (!description) return []
    return [
      {
        name: model.displayName,
        provider: model.slug.startsWith('yue') ? 'YuE' : 'ACE-Step',
        description,
        href: `/p/supported-models/${model.slug}/`,
        target: '_self',
        modality: 'audio',
        taskLabel: 'Text to Audio',
        capabilities: ['music'],
        tag: 'Open weights',
        statuses: ['open-weights'],
        supportedAt: model.releaseDate,
        media: model.thumbnailUrl
          ? { type: 'image', src: model.thumbnailUrl }
          : { type: 'placeholder', tone: 'plum' }
      }
    ]
  }
)

const additionalModels: Readonly<
  Record<
    string,
    {
      provider: string
      modality: string
      description: string
      capabilities?: string[]
    }
  >
> = {
  'gemma-3-12b-it-fp4-mixed': {
    provider: 'Google',
    modality: 'llm',
    description:
      'Process text and images with the instruction-tuned Gemma 3 model.'
  },
  'gemma-3-4b-it-bf16': {
    provider: 'Google',
    modality: 'llm',
    description: 'Run instruction-based language and vision tasks with Gemma 3.'
  },
  'qwen-3-8b-fp8mixed': {
    provider: 'Qwen',
    modality: 'llm',
    description: 'Generate and analyze text with Qwen 3 8B.'
  },
  'qwen3-5-2b-bf16': {
    provider: 'Qwen',
    modality: 'llm',
    description: 'Process language and images with Qwen 3.5 2B.'
  },
  'qwen-image-edit-2511-lightning-4steps-v1-0-bf16': {
    provider: 'Qwen',
    modality: 'image',
    description:
      'Edit images with the four-step Qwen Image Edit Lightning adapter.',
    capabilities: ['edit']
  },
  'trellis-2-int8-convrot': {
    provider: 'TRELLIS',
    modality: '3d',
    description: 'Generate textured 3D assets from images.'
  },
  'pixal3d-int8-convrot': {
    provider: 'Pixal3D',
    modality: '3d',
    description: 'Create 3D assets from reference images.'
  },
  'pixal3d-multiview-int8-convrot': {
    provider: 'Pixal3D',
    modality: '3d',
    description: 'Build 3D assets from multiple image views.'
  },
  'triposplat-fp16': {
    provider: 'Tripo',
    modality: '3d',
    description: 'Reconstruct 3D scenes from images with Gaussian splatting.'
  },
  'hunyuan-3d-v2-1': {
    provider: 'Tencent',
    modality: '3d',
    description: 'Generate 3D shapes and textures from images.'
  },
  'hunyuan3d-dit-v2-fp16': {
    provider: 'Tencent',
    modality: '3d',
    description: 'Generate 3D shapes from a reference image.'
  },
  'hunyuan3d-dit-v2-mv-fp16': {
    provider: 'Tencent',
    modality: '3d',
    description: 'Generate 3D shapes from multiple reference views.'
  },
  'hunyuan3d-dit-v2-mv-turbo-fp16': {
    provider: 'Tencent',
    modality: '3d',
    description: 'Generate 3D shapes from multiple views with faster sampling.'
  },
  'realesrgan-x4plus': {
    provider: 'Real-ESRGAN',
    modality: 'image',
    description: 'Upscale images and restore fine details.',
    capabilities: ['upscale']
  },
  'seedvr2-3b-int8-convrot': {
    provider: 'ByteDance',
    modality: 'video',
    description: 'Restore and upscale video frames.',
    capabilities: ['upscale']
  },
  'seedvr2-7b-int8-convrot': {
    provider: 'ByteDance',
    modality: 'video',
    description: 'Upscale video with detailed frame restoration.',
    capabilities: ['upscale']
  },
  'supir-v0q-fp16': {
    provider: 'SUPIR',
    modality: 'image',
    description: 'Restore and upscale images with generative detail.',
    capabilities: ['upscale']
  },
  'pid-flux1-1024-to-4096-4step-bf16': {
    provider: 'PID',
    modality: 'image',
    description: 'Upscale images from 1024 to 4096 pixels.',
    capabilities: ['upscale']
  },
  'qwen-image-edit-2511-bf16': {
    provider: 'Qwen',
    modality: 'image',
    description: 'Edit images with text instructions.',
    capabilities: ['edit']
  },
  'anthropic-claude': {
    provider: 'Anthropic',
    modality: 'llm',
    description: 'Generate and analyze text with Claude.'
  },
  openrouter: {
    provider: 'OpenRouter',
    modality: 'llm',
    description: 'Run language models through OpenRouter.'
  },
  'qwen-3-4b': {
    provider: 'Qwen',
    modality: 'llm',
    description: 'Generate and process text with Qwen 3.'
  },
  'qwen3-5-4b-bf16': {
    provider: 'Qwen',
    modality: 'llm',
    description: 'Process text and images with Qwen 3.5.'
  },
  'topaz-labs': {
    provider: 'Topaz',
    modality: 'video',
    description: 'Enhance and upscale video.',
    capabilities: ['upscale']
  },
  'magnific-ai': {
    provider: 'Magnific',
    modality: 'image',
    description: 'Upscale images and enhance details.',
    capabilities: ['upscale']
  },
  'tripo-3d': {
    provider: 'Tripo',
    modality: '3d',
    description: 'Generate 3D models from images.'
  },
  'hunyuan-3d': {
    provider: 'Tencent',
    modality: '3d',
    description: 'Create 3D models from reference images.'
  }
}
const additionalModelFixtures: ExploreModelCardFixture[] =
  canonicalModels.flatMap((model) => {
    const details = Object.entries(additionalModels).find(
      ([slug]) => slug === model.slug
    )?.[1]
    if (!details) return []
    return [
      {
        ...details,
        name: model.displayName,
        href: `/p/supported-models/${model.slug}/`,
        target: '_self',
        tag:
          model.directory === 'partner_nodes' ? 'Partner API' : 'Open weights',
        statuses: model.directory === 'partner_nodes' ? [] : ['open-weights'],
        supportedAt: model.releaseDate,
        media: model.thumbnailUrl
          ? { type: 'image', src: model.thumbnailUrl }
          : { type: 'placeholder', tone: 'plum' }
      }
    ]
  })

// Support-dated and popularity-ordered cards. They carry no usage measurement
// or verified release date, so they never feed Trending or Latest and only
// enrich catalog cards in the full directory.
export const catalogCardFixtures: ExploreModelCardFixture[] = [
  ...openAudioModels,
  ...additionalModelFixtures,
  ...sortWorkshopModels(workshopModels, 'popular').flatMap(
    (model): ExploreModelCardFixture[] => {
      if (
        !model.href?.startsWith('/hub/models/') ||
        model.status === 'deprecated' ||
        !model.summary ||
        !model.modality
      )
        return []
      return [
        {
          name: model.name,
          provider: model.provider,
          description: model.summary,
          href: model.href,
          taskLabel: taskLabelFor(model, 'en'),
          capabilities: model.capabilities,
          target: '_self',
          modality: model.modality === 'text' ? 'llm' : model.modality,
          tag: 'Partner API',
          media: model.thumbnailUrl
            ? { type: 'image', src: model.thumbnailUrl }
            : { type: 'placeholder', tone: 'canvas' }
        }
      ]
    }
  )
]

const verifiedReleaseFixtures: ExploreModelCardFixture[] =
  latestVerifiedModelVersions().map((model) => ({
    name: model.name,
    provider: model.name.startsWith('Qwen')
      ? 'Qwen'
      : model.name.startsWith('Nano Banana')
        ? 'Google'
        : 'ByteDance',
    description: t(model.descriptionKey, 'en'),
    href: model.href,
    ...hubTags(model.href),
    target: '_self',
    modality: model.modality,
    tag: model.access === 'partner-api' ? 'Partner API' : 'Open weights',
    ...(model.access === 'open-weights'
      ? { statuses: ['open-weights'] as const }
      : {}),
    releasedAt: model.releasedAt,
    sourceUrl: model.sourceUrl,
    media: { type: 'image', src: model.mediaSrc }
  }))

export const dayZeroModelFixtures: ExploreModelCardFixture[] =
  verifiedReleaseFixtures.toSorted((a, b) =>
    (b.releasedAt ?? '').localeCompare(a.releasedAt ?? '')
  )

export const taskFixtures: ExploreTaskFixture[] = [
  {
    title: 'AI interior design',
    description:
      'Redesign rooms from a photo while preserving their real layout.',
    workflowCount: 3,
    href: 'https://comfy.org/workflows/use-cases/ai-interior-design/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/a4700cc0-72ea-409e-9693-34a6d26a8c96.webp'
  },
  {
    title: 'AI image & video upscaler',
    description:
      'Increase resolution while preserving natural detail and texture.',
    workflowCount: 32,
    href: 'https://comfy.org/workflows/use-cases/ai-image-upscaler/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/24a6cdaf-2f22-47a0-b61c-bbeda152fbf8.png'
  },
  {
    title: 'AI image to video',
    description:
      'Animate still images with controllable motion using leading video models.',
    workflowCount: 95,
    href: 'https://comfy.org/workflows/use-cases/ai-image-to-video/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/templates/4c49ebf0-53fb-488e-a224-a26a32affb15.webp'
  },
  {
    title: 'Restore old photos',
    description:
      'Repair damage, recover faces, colorize prints, and upscale scans.',
    workflowCount: 7,
    href: 'https://comfy.org/workflows/use-cases/restore-old-photos/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/afaf876d-ffe1-4f6d-94a9-3bd4c581a921.png'
  },
  {
    title: 'AI anime generator',
    description:
      'Create anime characters and scenes from text with open models.',
    workflowCount: 8,
    href: 'https://comfy.org/workflows/use-cases/ai-anime-generator/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/19f8bb4b-9547-4d33-aeab-70b4f72a1c39.png'
  },
  {
    title: 'AI song generator',
    description:
      'Generate complete songs with vocals from prompts or your own lyrics.',
    workflowCount: 3,
    href: 'https://comfy.org/workflows/use-cases/ai-song-generator/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/470ff978-7fed-4d05-bf06-0de76d7396c6.png'
  },
  {
    title: 'AI music generator',
    description:
      'Generate instrumental music, loops, and sound effects from text.',
    workflowCount: 8,
    href: 'https://comfy.org/workflows/use-cases/ai-music-generator/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/597d9b7b-cf55-417d-b1ea-cb3710b0a840.png'
  },
  {
    title: 'AI hairstyle changer',
    description:
      'Preview new hairstyles from a portrait while preserving identity.',
    workflowCount: 1,
    href: 'https://comfy.org/workflows/use-cases/ai-hairstyle-changer/',
    mediaSrc:
      'https://comfy-hub-assets.comfy.org/uploads/9c8e4eb5-e3d1-438a-bcdf-c32d9e66642f.png'
  }
]

const featured = latestVerifiedModelVersions().at(0)
if (!featured)
  throw new Error('The supported model catalog needs a featured preview')

export const latestModelReleaseFixture: ExploreFeaturedRelease = {
  name: featured.name,
  provider: dayZeroModelFixtures[0].provider ?? featured.name,
  ...hubTags(featured.href),
  statuses: dayZeroModelFixtures[0].statuses,
  description: t(featured.descriptionKey, 'en'),
  href: featured.href,
  mediaSrc: featured.mediaSrc,
  publisher: t('models.explore.dayZero.label'),
  brandIconSrc:
    dayZeroModelFixtures[0].provider === 'Qwen'
      ? '/icons/ai-models/qwen.svg'
      : '/icons/comfyicon.svg',
  tags: [featured.modality]
}

const families = [
  {
    id: 'wan',
    titleKey: 'models.explore.family.wan.title',
    descriptionKey: 'models.explore.family.wan.description'
  },
  {
    id: 'minimax',
    titleKey: 'models.explore.family.minimax.title',
    descriptionKey: 'models.explore.family.minimax.description'
  },
  {
    id: 'seedance',
    titleKey: 'models.explore.family.seedance.title',
    descriptionKey: 'models.explore.family.seedance.description'
  }
] satisfies Pick<
  ExploreModelFamilyFixture,
  'id' | 'titleKey' | 'descriptionKey'
>[]

export const modelFamilyFixtures = families.flatMap(
  ({ id, titleKey, descriptionKey }) => {
    const family = illustratedModels.filter((model) => model.slug.includes(id))
    const illustrated = family.find((model) => model.thumbnailUrl)
    return illustrated?.thumbnailUrl
      ? [
          {
            id,
            titleKey,
            descriptionKey,
            mediaSrc: illustrated.thumbnailUrl,
            href: `/p/supported-models/${illustrated.slug}/`,
            variants: family.slice(0, 3).map((model) => model.displayName)
          }
        ]
      : []
  }
)
