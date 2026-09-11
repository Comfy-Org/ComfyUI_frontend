import { describe, expect, it } from 'vitest'

import type { UseCase, WorkshopModel } from './models-catalogue'
import { filterWorkshopModels } from './models-catalogue'

function model(useCase: UseCase): WorkshopModel {
  return {
    slug: useCase,
    name: useCase,
    workflowCount: 1,
    href: `/models/${useCase}/`,
    routerId: `test/${useCase}`,
    capabilities: [],
    useCases: [useCase]
  }
}

describe('other formats shelf', () => {
  it('includes text, 3D, and audio models without image or video models', () => {
    const candidates = [
      model('text'),
      model('3d'),
      model('audio'),
      model('generate-images'),
      model('generate-videos')
    ]

    expect(
      filterWorkshopModels(candidates, { useCase: 'other' }).map(
        (candidate) => candidate.slug
      )
    ).toEqual(['text', '3d', 'audio'])
  })
})
