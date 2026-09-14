import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../src/config/models-catalogue'
import type { HubTemplate } from '../src/lib/hub/types'
import { buildVersions } from './generate-workshop-versions'

const baseModel: WorkshopModel = {
  slug: 'kling-ai',
  name: 'Kling AI',
  workflowCount: 1,
  href: '/models/kling-ai/',
  routerId: 'kling/base',
  provider: 'Kling',
  modality: 'video',
  capabilities: []
}

function template(
  name: string,
  model: string,
  usage: number,
  thumbnail: string
): HubTemplate {
  return {
    name,
    title: model,
    mediaType: 'video',
    tags: ['API'],
    models: [model],
    logos: [],
    usage,
    date: '2026-09-10',
    thumbnails: [thumbnail],
    username: 'Comfy',
    isApp: false
  }
}

describe('buildVersions', () => {
  it('derives missing versions deterministically without module-level state', () => {
    const templates = [
      template('api_kling_v3_first', 'Kling V3', 1, 'first.webp'),
      template('api_kling_v3_popular', 'Kling V3', 5, 'popular.webp')
    ]

    const first = buildVersions(templates, [baseModel])
    const second = buildVersions(templates, [baseModel])

    expect(first).toEqual(second)
    expect(first).toEqual([
      {
        name: 'Kling V3',
        slug: 'kling-v3',
        baseSlug: 'kling-ai',
        provider: 'Kling',
        modality: 'video',
        workflowCount: 2,
        thumbnailUrl: 'popular.webp'
      }
    ])
  })
})
