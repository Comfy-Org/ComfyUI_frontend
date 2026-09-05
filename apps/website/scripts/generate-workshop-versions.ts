/**
 * The catalogue used to hold one entry per partner *node* — 48 of them — while
 * the templates name 97 distinct models: Wan 2.5 through 3.0, Vidu Q1 to Q3,
 * four Seedreams. This reads the models the templates actually declare and
 * writes the ones the catalogue is missing, each pointing at the node entry
 * whose schema, defaults and examples it runs on.
 *
 * Run after refreshing the template snapshot: pnpm workshop:generate-versions
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { workshopModels } from '../src/config/workshop'
import type { HubTemplate } from '../src/lib/hub/types'
import { API_PROVIDER_MAP } from './generate-models'

const DATA = join(import.meta.dirname, '..', 'src', 'data')
const OUTPUT = join(
  import.meta.dirname,
  '..',
  'src',
  'config',
  'workshop-model-versions.generated.json'
)

const MEDIA_TYPES = ['image', 'video', 'audio', '3d', 'text'] as const
type Modality = (typeof MEDIA_TYPES)[number]

interface Version {
  readonly name: string
  readonly slug: string
  readonly baseSlug: string
  readonly provider?: string
  readonly modality?: Modality
  readonly workflowCount: number
  readonly thumbnailUrl?: string
}

const templates = JSON.parse(
  readFileSync(join(DATA, 'hubTemplates.json'), 'utf8')
) as HubTemplate[]

const prefixes = Object.keys(API_PROVIDER_MAP).sort(
  (a, b) => b.length - a.length
)

function baseSlugOf(templateName: string): string | undefined {
  if (!templateName.startsWith('api_')) return undefined
  const stem = templateName.slice('api_'.length).toLowerCase()
  const prefix = prefixes.find(
    (key) => stem === key || stem.startsWith(`${key}_`)
  )
  return prefix ? API_PROVIDER_MAP[prefix].slug : undefined
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '')
    .replace(/api$/, '')

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const catalogued = new Set(workshopModels.map((model) => normalize(model.name)))
const providerNames = new Set(
  workshopModels.flatMap((model) =>
    model.provider ? [normalize(model.provider)] : []
  )
)
const bySlug = new Map(workshopModels.map((model) => [model.slug, model]))
const takenSlugs = new Set(workshopModels.map((model) => model.slug))

interface Draft {
  name: string
  baseSlug: string
  templates: HubTemplate[]
}

const drafts = new Map<string, Draft>()

for (const template of templates) {
  if (!template.tags.includes('API')) continue
  const baseSlug = baseSlugOf(template.name)
  if (!baseSlug || !bySlug.has(baseSlug)) continue

  for (const declared of template.models) {
    const key = normalize(declared)
    // A template that names its provider rather than a model, and every model
    // the catalogue already lists, stay out.
    const baseKey = normalize(bySlug.get(baseSlug)!.name)
    if (
      !key ||
      catalogued.has(key) ||
      providerNames.has(key) ||
      // "Grok" next to "Grok Imagine" is the node's own name, not a release.
      baseKey.startsWith(key)
    )
      continue
    const draft = drafts.get(key) ?? { name: declared, baseSlug, templates: [] }
    draft.templates.push(template)
    drafts.set(key, draft)
  }
}

function majority<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
}

const isModality = (value: string): value is Modality =>
  (MEDIA_TYPES as readonly string[]).includes(value)

const versions: Version[] = [...drafts.values()]
  .map((draft) => {
    const base = bySlug.get(draft.baseSlug)!
    const busiest = [...draft.templates].sort((a, b) => b.usage - a.usage)[0]
    const declaredModality = majority(
      draft.templates.map((template) => template.mediaType)
    )
    // A chat model stays text however the workflow around it renders.
    const modality =
      base.modality === 'text'
        ? base.modality
        : declaredModality && isModality(declaredModality)
          ? declaredModality
          : base.modality
    let slug = slugify(draft.name)
    while (takenSlugs.has(slug)) slug = `${slug}-${draft.baseSlug}`
    takenSlugs.add(slug)
    return {
      name: draft.name,
      slug,
      baseSlug: draft.baseSlug,
      ...(base.provider ? { provider: base.provider } : {}),
      ...(modality ? { modality } : {}),
      workflowCount: draft.templates.length,
      ...(busiest?.thumbnails[0] ? { thumbnailUrl: busiest.thumbnails[0] } : {})
    }
  })
  .sort((a, b) => a.slug.localeCompare(b.slug))

writeFileSync(OUTPUT, `${JSON.stringify(versions, null, 2)}\n`)
console.log(
  `Wrote ${versions.length} models the templates name but the catalogue was missing.`
)
