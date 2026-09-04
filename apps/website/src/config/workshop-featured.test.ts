import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { WorkshopBrowseModel } from './workshop'
import {
  FEATURED_WORKSHOP_MODEL_IDS,
  featuredWorkshopModels
} from './workshop-featured'

// The committed catalog is one packed array, a model per line; read it rather
// than scanning a directory that no longer exists.
const CATALOG = join(import.meta.dirname, '../content/workshop-models.json')

function catalogIds(): Set<string> {
  return new Set(
    (JSON.parse(readFileSync(CATALOG, 'utf8')) as { id: string }[]).map(
      (entry) => entry.id
    )
  )
}

function model(id: string): WorkshopBrowseModel {
  return {
    id,
    slug: id.replace('/', '--'),
    href: `/workshop/models/${id.replace('/', '--')}/`,
    name: id,
    provider: id.split('/')[0],
    output: 'image',
    description: '',
    tags: []
  }
}

describe('featured Workshop models', () => {
  it('names models the catalog still has', () => {
    // The catalog is regenerated from whatever Router serves. When a partner
    // retires a featured model this fails, rather than the homepage quietly
    // rendering five cards instead of six.
    const ids = catalogIds()
    expect(FEATURED_WORKSHOP_MODEL_IDS.filter((id) => !ids.has(id))).toEqual([])
  })

  it('keeps the editorial order rather than the catalog order', () => {
    const shuffled = [...FEATURED_WORKSHOP_MODEL_IDS].reverse().map(model)

    expect(featuredWorkshopModels(shuffled).map((entry) => entry.id)).toEqual([
      ...FEATURED_WORKSHOP_MODEL_IDS
    ])
  })

  it('skips a retired model instead of emitting a hole', () => {
    const withoutFirst = FEATURED_WORKSHOP_MODEL_IDS.slice(1).map(model)
    const resolved = featuredWorkshopModels(withoutFirst)

    expect(resolved).toHaveLength(FEATURED_WORKSHOP_MODEL_IDS.length - 1)
    expect(resolved.every((entry) => entry !== undefined)).toBe(true)
  })
})
