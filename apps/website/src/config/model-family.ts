import type { WorkshopModel } from './workshop'

// The registry lists every release as its own model: Wan, Wan 2.6, Wan 2.7 and
// Wan 3.0 are four entries, and "Flux" appears twice. A visitor browsing the
// catalogue wants the family once, with its releases behind it.
export interface ModelFamily {
  readonly key: string
  readonly name: string
  readonly latest: WorkshopModel
  readonly versions: readonly WorkshopModel[]
}

const VERSION_SUFFIX = /\s+v?(\d+(?:\.\d+)*)$/i

// Releases the registry names without a number of their own.
const FAMILY_NAMES: Readonly<Record<string, string>> = {
  'kling-ai': 'Kling',
  'kling-o3': 'Kling',
  'meshy-ai': 'Meshy'
}

function familyNameOf(model: WorkshopModel): string {
  const stripped = model.name.replace(VERSION_SUFFIX, '').trim()
  return FAMILY_NAMES[model.slug] ?? (stripped || model.name)
}

function versionOf(model: WorkshopModel): string | undefined {
  return VERSION_SUFFIX.exec(model.name)?.[1]
}

// A release with no number is the family's first, so it sorts last.
function versionRank(model: WorkshopModel): readonly number[] {
  const parts = versionOf(model)?.split('.').map(Number)
  return parts ?? [-1]
}

function byNewest(a: WorkshopModel, b: WorkshopModel): number {
  const [left, right] = [versionRank(a), versionRank(b)]
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (right[i] ?? 0) - (left[i] ?? 0)
    if (diff !== 0) return diff
  }
  return b.workflowCount - a.workflowCount || a.name.localeCompare(b.name)
}

// Families come out in the order their first member arrived, so whatever
// sorted the models still decides the order of the grid.
export function groupByFamily(models: readonly WorkshopModel[]): ModelFamily[] {
  const groups = new Map<string, { name: string; members: WorkshopModel[] }>()
  for (const model of models) {
    const name = familyNameOf(model)
    const key = `${model.provider ?? ''}:${name}`
    const group = groups.get(key) ?? { name, members: [] }
    group.members.push(model)
    groups.set(key, group)
  }
  return [...groups].map(([key, { name, members }]) => {
    const versions = dedupeByName([...members].sort(byNewest))
    return { key, name, latest: versions[0], versions }
  })
}

// The registry carries the same release twice under two slugs ("Flux" is both
// `flux` and `flux-api`); the switcher shows it once, the one with more
// workflows behind it.
function dedupeByName(sorted: readonly WorkshopModel[]): WorkshopModel[] {
  const seen = new Set<string>()
  return sorted.filter((model) => {
    if (seen.has(model.name)) return false
    seen.add(model.name)
    return true
  })
}

export function familyOf(
  models: readonly WorkshopModel[],
  slug: string
): ModelFamily | undefined {
  const model = models.find((candidate) => candidate.slug === slug)
  if (!model) return undefined
  const key = `${model.provider ?? ''}:${familyNameOf(model)}`
  return groupByFamily(models).find((family) => family.key === key)
}
