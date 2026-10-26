import { describe, expect, it } from 'vitest'

import type { UseCase, WorkshopModel } from '@/config/models-catalogue'
import { hubTaskOf } from './hub-tasks'

function hosted(useCase: UseCase, capabilities: string[] = []): WorkshopModel {
  return {
    slug: 'm',
    name: 'M',
    routerId: 'acme/m',
    workflowCount: 0,
    capabilities,
    useCases: [useCase]
  }
}

function workflow(useCase: UseCase, category: string): WorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: 'w',
    slug: 'workflows/w',
    href: '/hub/workflows/w/',
    name: 'W',
    workflowCount: 1,
    capabilities: [],
    useCases: [useCase],
    category
  }
}

describe('hubTaskOf', () => {
  it.for([
    {
      item: 'image generator',
      model: hosted('generate-images'),
      leaf: 'generate-images'
    },
    { item: 'image editor', model: hosted('edit-images'), leaf: 'edit-images' },
    {
      item: 'image upscaler',
      model: hosted('edit-images', ['Upscale']),
      leaf: 'upscale'
    },
    {
      item: 'upscale workflow',
      model: workflow('edit-images', 'upscale'),
      leaf: 'upscale'
    },
    {
      item: 'image-to-image workflow',
      model: workflow('edit-images', 'image-to-image'),
      leaf: 'edit-images'
    },
    {
      item: 'video upscaler',
      model: hosted('edit-videos', ['upscale']),
      leaf: 'upscale'
    },
    {
      item: 'video upscale workflow',
      model: workflow('edit-videos', 'upscale'),
      leaf: 'upscale'
    },
    {
      item: 'image animator',
      model: hosted('animate-images'),
      leaf: 'animate-images'
    },
    { item: 'speech model', model: hosted('audio'), leaf: 'audio' },
    { item: '3D model', model: hosted('3d'), leaf: undefined }
  ])('places an $item under $leaf', ({ model, leaf }) => {
    expect(hubTaskOf(model)).toBe(leaf)
  })
})
