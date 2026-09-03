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

// "Wan 2.6", "Wan2.5", "LTX-2.5", "Vidu Q3", "Kling O1": the registry spells a
// release every way there is, and each spelling has to fall off the name for
// the family to come out.
const VERSION_SUFFIX =
  /(?:[\s\-.]+v?[A-Za-z]?(\d+(?:\.\d+)*)|(\d+(?:\.\d+)*))$/i
const QUALIFIER_SUFFIX =
  /[\s-]+(pro|lite|flash|turbo|mini|max|ultra|plus|ai|3d)$/i

function stripRelease(name: string): string {
  let stripped = name.trim()
  for (let pass = 0; pass < 3; pass += 1) {
    const shorter = stripped
      .replace(QUALIFIER_SUFFIX, '')
      .replace(VERSION_SUFFIX, '')
      .trim()
    if (shorter === stripped || shorter === '') break
    stripped = shorter
  }
  return stripped
}

function familyNameOf(model: WorkshopModel): string {
  return stripRelease(model.name) || model.name
}

// Two spellings of one family ("GPT Image 2", "GPT-Image-1.5") share a key.
function familyKeyOf(model: WorkshopModel): string {
  return `${model.provider ?? ''}:${familyNameOf(model)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '')}`
}

function versionOf(model: WorkshopModel): string | undefined {
  const match = VERSION_SUFFIX.exec(model.name)
  return match?.[1] ?? match?.[2]
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
    const key = familyKeyOf(model)
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

// Grouping is a prototype variant, not a settled decision: the TDD describes a
// catalogue of every partner model, one card and one page each. Off, each
// release stands alone; on, the releases collapse behind the newest.
export function groupModels(
  models: readonly WorkshopModel[],
  grouped: boolean
): ModelFamily[] {
  return grouped
    ? groupByFamily(models)
    : models.map((model) => ({
        key: model.slug,
        name: model.name,
        latest: model,
        versions: [model]
      }))
}

export function familyOf(
  models: readonly WorkshopModel[],
  slug: string
): ModelFamily | undefined {
  const model = models.find((candidate) => candidate.slug === slug)
  if (!model) return undefined
  const key = familyKeyOf(model)
  return groupByFamily(models).find((family) => family.key === key)
}
