import { describe, expect, it } from 'vitest'

import type { UseCase, WorkshopModel } from '@/config/models-catalogue'
import { hubTaskAddress, hubTaskOf, parseHubTaskKey } from './hub-tasks'

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

describe('the task address', () => {
  it.for([
    { search: '?task=edit-images', key: 'edit-images' },
    { search: '?task=upscale&q=a', key: 'upscale' },
    { search: '?task=nonsense', key: 'all' },
    { search: '', key: 'all' }
  ] as const)('reads "$search" as $key', ({ search, key }) => {
    expect(parseHubTaskKey(search)).toBe(key)
  })

  it.for([
    {
      from: 'https://x/hub/?task=upscale&q=a',
      key: 'audio',
      to: 'https://x/hub/?task=audio&q=a'
    },
    {
      from: 'https://x/hub/?type=workflows',
      key: 'upscale',
      to: 'https://x/hub/?type=workflows&task=upscale'
    },
    { from: 'https://x/hub/?task=audio', key: 'all', to: 'https://x/hub/' }
  ] as const)('writes $key over $from', ({ from, key, to }) => {
    expect(hubTaskAddress(from, key)).toBe(to)
  })
})
