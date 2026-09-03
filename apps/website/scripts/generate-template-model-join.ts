/**
 * Which workflow runs on which partner model.
 *
 * Most API templates name their model in `models[]`, and an exact name match
 * resolves those at runtime. The rest only carry it in the file name
 * (`api_seedance2_5_t2v`), which the provider map can decode — but decoding a
 * prefix guesses, and a guess once sent a FLUX 3 video workflow to the FLUX
 * image playground. So every decoded row must agree with the model on what it
 * produces; the ones that disagree are dropped rather than shipped wrong.
 *
 * Run after refreshing the template snapshot: pnpm hub:generate-join
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { workshopModels } from '../src/config/workshop'
import type { HubTemplate } from '../src/lib/hub/types'
import { modelNamedBy } from '../src/lib/hub/template-use-case'
import { API_PROVIDER_MAP } from './generate-models'

const DATA = join(import.meta.dirname, '..', 'src', 'data')
const templates = JSON.parse(
  readFileSync(join(DATA, 'hubTemplates.json'), 'utf8')
) as HubTemplate[]

const bySlug = new Map(workshopModels.map((model) => [model.slug, model]))
const prefixes = Object.keys(API_PROVIDER_MAP).sort(
  (a, b) => b.length - a.length
)

function decodeFromName(name: string): string | undefined {
  if (!name.startsWith('api_')) return undefined
  const stem = name.slice('api_'.length)
  const prefix = prefixes.find((key) => stem.startsWith(key))
  return prefix ? API_PROVIDER_MAP[prefix].slug : undefined
}

const joined: Record<string, string> = {}
const rejected: string[] = []

for (const template of templates) {
  if (!template.tags.includes('API')) continue
  if (modelNamedBy(template, workshopModels)) continue

  const slug = decodeFromName(template.name)
  const model = slug ? bySlug.get(slug) : undefined
  if (!model) continue

  if (model.modality === template.mediaType) {
    joined[template.name] = model.slug
  } else {
    rejected.push(
      `${template.name} → ${model.slug} (${template.mediaType} workflow, ${model.modality} model)`
    )
  }
}

const sorted = Object.fromEntries(
  Object.entries(joined).sort(([a], [b]) => a.localeCompare(b))
)
writeFileSync(
  join(DATA, 'templateModelJoin.json'),
  `${JSON.stringify(sorted, null, 2)}\n`
)

console.log(`Joined ${Object.keys(sorted).length} workflows to a model.`)
console.log(`Dropped ${rejected.length} rows that disagreed on the medium:`)
for (const row of rejected) console.log(`  ${row}`)
