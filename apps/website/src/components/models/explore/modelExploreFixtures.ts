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
  name: string
  description: string
  href: string
  target: '_self' | '_blank'
  modality: string
  tag: string
  statuses?: readonly ExploreModelStatus[]
  media: ExploreModelMedia
  sourceUrl?: string
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

const canonicalModels = models.filter((model) => !model.canonicalSlug)
const illustratedModels = canonicalModels.filter(
  (model) =>
    model.thumbnailUrl &&
    ['diffusion_models', 'checkpoints', 'partner_nodes'].includes(
      model.directory
    )
)

const validatedTrendSnapshot = modelTrendSnapshotSchema.parse(trendSnapshot)
export const modelTrendsAsOf = validatedTrendSnapshot.asOf

export const trendingModelFixtures: ExploreModelCardFixture[] = rankModelTrends(
  validatedTrendSnapshot
).map((model) => ({
  name: model.name,
  description:
    model.growthPercent === null
      ? t('models.explore.trending.new', 'en', { users: model.gain })
      : t('models.explore.trending.growth', 'en', {
          percent: model.growthPercent,
          users: model.gain
        }),
  href: model.href,
  target: model.href.startsWith('https:') ? '_blank' : '_self',
  modality: model.modality,
  tag: 'Partner API',
  media: model.mediaSrc
    ? { type: 'image', src: model.mediaSrc }
    : { type: 'placeholder', tone: 'canvas' }
}))

export const dayZeroModelFixtures: ExploreModelCardFixture[] =
  latestVerifiedModelVersions().map((model) => ({
    name: model.name,
    description: t('models.explore.release.date', 'en', {
      date: model.releasedAt
    }),
    href: model.href,
    target: '_self',
    modality: model.modality,
    tag: model.access === 'partner-api' ? 'Partner API' : 'Open weights',
    ...(model.access === 'open-weights'
      ? { statuses: ['open-weights'] as const }
      : {}),
    sourceUrl: model.sourceUrl,
    media: { type: 'image', src: model.mediaSrc }
  }))

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

const featured = latestVerifiedModelVersions().at(0)
if (!featured)
  throw new Error('The supported model catalog needs a featured preview')

export const latestModelReleaseFixture: ExploreFeaturedRelease = {
  name: featured.name,
  description: t('models.explore.release.date', 'en', {
    date: featured.releasedAt
  }),
  href: featured.href,
  mediaSrc: featured.mediaSrc,
  publisher: t('models.explore.dayZero.label'),
  brandIconSrc: '/icons/comfyicon.svg',
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
