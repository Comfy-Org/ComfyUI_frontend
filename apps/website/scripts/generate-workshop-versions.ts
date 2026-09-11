/**
 * The catalogue used to hold one entry per partner *node* — 48 of them — while
 * the templates name 97 distinct models: Wan 2.5 through 3.0, Vidu Q1 to Q3,
 * four Seedreams. This reads the models the templates actually declare and
 * writes the ones the catalogue is missing, each pointing at the node entry
 * whose schema, defaults and examples it runs on.
 *
 * Run after refreshing the template snapshot: pnpm workshop:generate-versions
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { workshopModels } from '../src/config/models-catalogue'
import type { WorkshopModel } from '../src/config/models-catalogue'
import type { HubTemplate } from '../src/lib/hub/types'
import { API_PROVIDER_MAP } from './generate-models'
import { isDirectExecution } from './script-entry-point'

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

export interface Version {
  readonly name: string
  readonly slug: string
  readonly baseSlug: string
  readonly provider?: string
  readonly modality?: Modality
  readonly workflowCount: number
  readonly thumbnailUrl?: string
}

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

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '')
    .replace(/api$/, '')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface Draft {
  name: string
  baseSlug: string
  templates: HubTemplate[]
}

function majority<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
}

function isModality(value: string): value is Modality {
  return (MEDIA_TYPES as readonly string[]).includes(value)
}

export function buildVersions(
  templates: readonly HubTemplate[],
  models: readonly WorkshopModel[] = workshopModels
): Version[] {
  const catalogued = new Set(models.map((model) => normalize(model.name)))
  const providerNames = new Set(
    models.flatMap((model) =>
      model.provider ? [normalize(model.provider)] : []
    )
  )
  const bySlug = new Map(models.map((model) => [model.slug, model]))
  const takenSlugs = new Set(models.map((model) => model.slug))
  const drafts = new Map<string, Draft>()

  for (const template of templates) {
    if (!template.tags.includes('API')) continue
    const baseSlug = baseSlugOf(template.name)
    const base = baseSlug ? bySlug.get(baseSlug) : undefined
    if (!baseSlug || !base) continue

    for (const declared of template.models) {
      const key = normalize(declared)
      const baseKey = normalize(base.name)
      if (
        !key ||
        catalogued.has(key) ||
        providerNames.has(key) ||
        baseKey.startsWith(key)
      )
        continue
      const draft = drafts.get(key) ?? {
        name: declared,
        baseSlug,
        templates: []
      }
      draft.templates.push(template)
      drafts.set(key, draft)
    }
  }

  return [...drafts.values()]
    .map((draft) => {
      const base = bySlug.get(draft.baseSlug)
      if (!base) throw new Error(`Missing base model: ${draft.baseSlug}`)
      const busiest = [...draft.templates].sort((a, b) => b.usage - a.usage)[0]
      const declaredModality = majority(
        draft.templates.map((template) => template.mediaType)
      )
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
        ...(busiest.thumbnails[0]
          ? { thumbnailUrl: busiest.thumbnails[0] }
          : {})
      }
    })
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

function main() {
  const templates = JSON.parse(
    readFileSync(join(DATA, 'hubTemplates.json'), 'utf8')
  ) as HubTemplate[]
  const versions = buildVersions(templates)
  const packed = `${JSON.stringify(versions, null, 2)}\n`
  if (!existsSync(OUTPUT) || readFileSync(OUTPUT, 'utf8') !== packed)
    writeFileSync(OUTPUT, packed)
  process.stdout.write(
    `Wrote ${versions.length} models the templates name but the catalogue was missing.\n`
  )
}

if (isDirectExecution(process.argv[1], import.meta.filename)) main()
