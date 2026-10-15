import { describe, expect, it } from 'vitest'

import type {
  UseCase,
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import { relatedWorkflows } from './related-workflows'

function workflow(
  slug: string,
  useCase: UseCase,
  recommendedRank?: number
): WorkflowWorkshopModel {
  return {
    slug,
    name: slug,
    href: `/hub/workflows/${slug}/`,
    workflowId: slug,
    type: 'CLOUD',
    workflowCount: 0,
    capabilities: [],
    useCases: [useCase],
    modality: useCase.endsWith('images') ? 'image' : 'video',
    recommendedRank
  }
}

const model: WorkshopModel = {
  slug: 'relight-model',
  name: 'Relight model',
  routerId: 'lab/relight',
  workflowCount: 0,
  capabilities: [],
  useCases: ['edit-images'],
  modality: 'image'
}

describe('relatedWorkflows', () => {
  const current = workflow('match-lighting', 'edit-images', 4)
  const catalogue = [
    current,
    workflow('upscale-video', 'edit-videos', 0),
    workflow('make-image', 'generate-images', 1),
    workflow('remove-background', 'edit-images', 3),
    workflow('change-material', 'edit-images', 2),
    workflow('restore-portrait', 'edit-images'),
    model
  ]

  it('offers the same use case first, then the same media, never itself or a model', () => {
    expect(
      relatedWorkflows(current, catalogue).map(({ slug }) => slug)
    ).toEqual([
      'change-material',
      'remove-background',
      'restore-portrait',
      'make-image'
    ])
  })

  it('stops at the limit', () => {
    expect(
      relatedWorkflows(current, catalogue, 2).map(({ slug }) => slug)
    ).toEqual(['change-material', 'remove-background'])
  })

  it('offers nothing when no other workflow is near it', () => {
    expect(
      relatedWorkflows(current, [current, workflow('x', 'edit-videos')])
    ).toEqual([])
  })
})
