import type { WorkshopModel } from '@/config/models-catalogue'
import { sortWorkshopModels } from '@/config/models-catalogue'
import type { OpenWeightModel } from './explorer/open-weight-models'

export const MODELS_CATALOGUE_ID = 'models-catalogue'

interface PartnerRelease {
  readonly slug: string
  /** ISO date of the vendor's own release announcement. */
  readonly releasedAt: string
}

// The catalogue carries no release dates, so the launches are dated here from
// each vendor's announcement.
const PARTNER_RELEASES: readonly PartnerRelease[] = [
  {
    slug: 'byteplus--seedance-2-5-text-to-video--generate-videos',
    releasedAt: '2026-07-31'
  },
  {
    slug: 'byteplus--seedream-5-pro--generate-images',
    releasedAt: '2026-07-08'
  },
  {
    slug: 'vertexai--gemini-nano-banana-2--generate-images',
    releasedAt: '2026-02-26'
  }
]

export function latestLaunch(
  models: readonly WorkshopModel[],
  releases: readonly PartnerRelease[] = PARTNER_RELEASES
): WorkshopModel | undefined {
  const bySlug = new Map(models.map((model) => [model.slug, model]))
  return releases
    .toSorted((a, b) => b.releasedAt.localeCompare(a.releasedAt))
    .map((release) => bySlug.get(release.slug))
    .find((model) => model?.href !== undefined)
}

export interface ModelsHubCounts {
  readonly models: number
  readonly openWeights: number
  readonly partner: number
}

export function modelsHubCounts(
  partner: readonly WorkshopModel[],
  openWeights: readonly OpenWeightModel[]
): ModelsHubCounts {
  return {
    models: partner.length + openWeights.length,
    openWeights: openWeights.length,
    partner: partner.length
  }
}

interface FamilyRelease {
  readonly version: string
  readonly open: boolean
  /** What the catalogue search needs to list this release. */
  readonly query: string
}

export interface FamilyShowcase {
  readonly cover?: WorkshopModel
  readonly releases: readonly FamilyRelease[]
}

function hasStill({ thumbnail }: WorkshopModel): boolean {
  return thumbnail?.kind === 'image' || thumbnail?.poster !== undefined
}

function newestFirst(a: FamilyRelease, b: FamilyRelease): number {
  const [left, right] = [a, b].map((release) =>
    release.version.split('.').map(Number)
  )
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (right[i] ?? 0) - (left[i] ?? 0)
    if (diff !== 0) return diff
  }
  return Number(a.open) - Number(b.open)
}

/**
 * A family's releases as the catalogue names them: hosted releases spell
 * "Wan 3.0 Text-to-Video", open weights "Wan2.2 T2v 14B". A family with no
 * release on either side has nothing to show. The cover is the most popular
 * release with a still to show, since a video without a poster is blank until
 * it plays.
 */
export function familyShowcase(
  family: string,
  hosted: readonly WorkshopModel[],
  openWeights: readonly OpenWeightModel[]
): FamilyShowcase | undefined {
  const hostedVersion = new RegExp(`^${family}\\s+(\\d+(?:\\.\\d+)?)\\b`, 'i')
  const openVersion = new RegExp(`^${family}\\s?(\\d+)\\.(\\d+)\\b`, 'i')
  const members = sortWorkshopModels(
    hosted.filter((model) => hostedVersion.test(model.name)),
    'popular'
  )
  const releases = new Map<string, FamilyRelease>()
  for (const model of members) {
    const version = hostedVersion.exec(model.name)?.[1]
    if (version && !releases.has(version))
      releases.set(version, {
        version,
        open: false,
        query: `${family} ${version}`
      })
  }
  for (const model of openWeights) {
    const match = openVersion.exec(model.name)
    if (!match) continue
    const version = `${match[1]}.${match[2]}`
    const key = `open:${version}`
    if (!releases.has(key))
      releases.set(key, { version, open: true, query: `${family}${version}` })
  }
  if (releases.size === 0) return undefined
  return {
    cover: members.find(hasStill),
    releases: [...releases.values()].toSorted(newestFirst)
  }
}
