import { describe, expect, it } from 'vitest'

import type { WorkshopBrowseModel } from './workshop'
import {
  countWorkshopOutputs,
  filterWorkshopModels,
  workshopModels
} from './workshop'

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
    expect(workshopModels).toHaveLength(268)
    expect(new Set(workshopModels.map((model) => model.id)).size).toBe(268)
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
