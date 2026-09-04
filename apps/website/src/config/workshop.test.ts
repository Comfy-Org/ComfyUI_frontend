import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { workshopModelSchema } from '../content/workshop-models.schema'
import type { WorkshopBrowseModel } from './workshop'
import {
  countWorkshopOutputs,
  filterWorkshopModels,
  toBrowseModel
} from './workshop'

// The committed catalog: one packed array, a model per line. Read it the way
// the content loader does rather than scanning a directory that no longer
// exists, and validate every entry so the test fails on a bad catalog.
const CATALOG = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'content',
  'workshop-models.json'
)

const collection = (JSON.parse(readFileSync(CATALOG, 'utf8')) as unknown[]).map(
  (entry) => workshopModelSchema.parse(entry)
)

const models: WorkshopBrowseModel[] = [
  {
    id: 'bfl/flux',
    slug: 'bfl--flux',
    href: '/workshop/models/bfl--flux/',
    name: 'Flux',
    provider: 'bfl',
    output: 'image',
    description: 'Generates an image from text.',
    tags: ['text-to-image']
  },
  {
    id: 'kling/video',
    slug: 'kling--video',
    href: '/workshop/models/kling--video/',
    name: 'Kling Video',
    provider: 'kling',
    output: 'video',
    description: 'Animates an image.',
    tags: ['image-to-video']
  }
]

describe('Workshop catalog', () => {
  it('contains every model in the committed Router snapshot', () => {
    expect(collection).toHaveLength(268)
    expect(new Set(collection.map((model) => model.id)).size).toBe(268)
  })

  it('projects a card without the model input schema', () => {
    // The browse island receives these over the wire, and `parameters` is the
    // bulk of an entry, so a projection that leaked it would quietly multiply
    // the page weight.
    const card = toBrowseModel(collection[0])

    expect(card.id).toBe(collection[0].id)
    expect(card.href).toBe(`/workshop/models/${collection[0].slug}/`)
    expect(Object.keys(card)).not.toContain('parameters')
  })

  it('searches names, providers, descriptions, and tags', () => {
    expect(filterWorkshopModels(models, { query: 'animate' })).toEqual([
      models[1]
    ])
    expect(filterWorkshopModels(models, { query: 'BFL' })).toEqual([models[0]])
    expect(filterWorkshopModels(models, { query: 'text to image' })).toEqual([
      models[0]
    ])
  })

  it('combines output and provider filters', () => {
    expect(
      filterWorkshopModels(models, { output: 'video', provider: 'kling' })
    ).toEqual([models[1]])
    expect(
      filterWorkshopModels(models, { output: 'image', provider: 'kling' })
    ).toEqual([])
  })

  it('counts the output groups', () => {
    expect(countWorkshopOutputs(models)).toEqual({
      all: 2,
      image: 1,
      video: 1,
      audio: 0,
      '3d': 0
    })
  })
})
