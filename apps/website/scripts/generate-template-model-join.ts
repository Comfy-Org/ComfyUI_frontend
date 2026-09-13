/**
 * Which workflow runs on which partner model.
 *
 * Most API templates name their model in `models[]`, and an exact name match
 * resolves those at runtime. The rest only carry it in the file name
 * (`api_seedance2_5_t2v`), which the provider map can decode — but decoding a
 * prefix guesses, and a guess once sent a FLUX 3 video workflow to the FLUX
 * image playground. Resolve through the same task-aware, unique-match rule as
 * navigation. Thumbnail mediaType must never decide a model's operation.
 *
 * Run after refreshing the template snapshot: pnpm hub:generate-join
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { workshopModels } from '../src/config/models-catalogue'
import type { WorkshopModel } from '../src/config/models-catalogue'
import { routerModelSlugAliases } from '../src/config/workshop-browse-content'
import { hubTemplatesSchema } from '../src/lib/hub/types'
import { modelNamedBy, partnerModelFor } from '../src/lib/hub/template-use-case'
import { API_PROVIDER_MAP } from './generate-models'
import { isDirectExecution } from './script-entry-point'

const DATA = join(import.meta.dirname, '..', 'src', 'data')

// These template names identify an exact operation. Keep this small and
// explicit: a provider/family prefix alone is not evidence of version parity.
const EXACT_MODEL_SLUGS = new Map(
  Object.entries({
    api_seedance2_5_r2v: 'byteplus--seedance-2-5-reference--generate-videos',
    api_beeble_switchx_image_edit: 'beeble--switchx-image-edit--edit-images',
    api_beeble_switchx_video_edit: 'beeble--switchx-video-edit--edit-videos'
  })
)

// Keep both the operation and version from the template. An unavailable 1.0
// model is not silently upgraded to 1.1 just because its family is the same.
const EXACT_ROUTER_IDS = new Map(
  Object.entries({
    api_happyhorse1_0_i2v: 'wan/happyhorse-1.0-i2v',
    api_happyhorse1_0_r2v: 'wan/happyhorse-1.0-r2v',
    api_happyhorse1_0_t2v: 'wan/happyhorse-1.0-t2v',
    api_happyhorse1_0_video_edit: 'wan/happyhorse-1.0-video-edit',
    api_happyhorse1_1_i2v: 'wan/happyhorse-1.1-i2v',
    api_happyhorse1_1_r2v: 'wan/happyhorse-1.1-r2v',
    api_happyhorse1_1_t2v: 'wan/happyhorse-1.1-t2v'
  })
)
const prefixes = Object.keys(API_PROVIDER_MAP).sort(
  (a, b) => b.length - a.length
)

function decodeFromName(name: string): string | undefined {
  if (!name.startsWith('api_')) return undefined
  const stem = name.slice('api_'.length)
  const prefix = prefixes.find(
    (key) => stem === key || stem.startsWith(`${key}_`)
  )
  return prefix ? API_PROVIDER_MAP[prefix].slug : undefined
}

export function buildTemplateModelJoin(
  rawTemplates: unknown,
  models: readonly WorkshopModel[] = workshopModels
): { joined: Record<string, string>; rejected: string[] } {
  const templates = hubTemplatesSchema.parse(rawTemplates)
  const joined: Record<string, string> = {}
  const rejected: string[] = []

  for (const template of templates) {
    if (!template.tags.includes('API')) continue
    if (modelNamedBy(template, models)) continue

    const exactId = EXACT_ROUTER_IDS.get(template.name)
    const family = decodeFromName(template.name)
    const sourceSlug =
      EXACT_MODEL_SLUGS.get(template.name) ??
      (exactId ? exactId.replace('/', '--') : family)
    if (!sourceSlug) continue
    const slug = routerModelSlugAliases.get(sourceSlug) ?? sourceSlug
    const model = partnerModelFor(template, models, slug)
    if (model) {
      joined[template.name] = model.slug
    } else {
      rejected.push(
        `${template.name} → ${sourceSlug} (no unique model for the declared task)`
      )
    }
  }

  return {
    joined: Object.fromEntries(
      Object.entries(joined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    ),
    rejected
  }
}

function main() {
  const rawTemplates: unknown = JSON.parse(
    readFileSync(join(DATA, 'hubTemplates.json'), 'utf8')
  )
  const { joined, rejected } = buildTemplateModelJoin(rawTemplates)
  writeFileSync(
    join(DATA, 'templateModelJoin.json'),
    `${JSON.stringify(joined, null, 2)}\n`
  )

  process.stdout.write(
    `Joined ${Object.keys(joined).length} workflows to a model.\n`
  )
  process.stdout.write(
    `Left ${rejected.length} unavailable or ambiguous rows unmapped:\n`
  )
  for (const row of rejected) process.stdout.write(`  ${row}\n`)
}

if (isDirectExecution(process.argv[1], import.meta.filename)) main()
