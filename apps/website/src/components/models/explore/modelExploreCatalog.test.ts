import { describe, expect, it } from 'vitest'

import { models } from '../../../config/models'
import type { Model } from '../../../config/models'
import {
  createModelExploreCatalog,
  filterModelExploreCatalog,
  summarizeModelExploreCatalog
} from './modelExploreCatalog'

describe('summarizeModelExploreCatalog', () => {
  it('separates local model components from partner integrations', () => {
    const catalog = [
      { directory: 'checkpoints' },
      { directory: 'loras' },
      { directory: 'partner_nodes' },
      { directory: 'partner_nodes', canonicalSlug: 'partner-image' }
    ] satisfies Array<Pick<Model, 'directory' | 'canonicalSlug'>>

    expect(summarizeModelExploreCatalog(catalog)).toEqual({
      catalogCount: 3,
      localComponentCount: 2,
      partnerIntegrationCount: 1
    })
  })
})

describe('model explore catalog presentation', () => {
  const catalog = createModelExploreCatalog([
    {
      slug: 'wan-video',
      name: 'wan_video.safetensors',
      displayName: 'Wan Video',
      directory: 'diffusion_models',
      huggingFaceUrl: '',
      featured: false,
      workflowCount: 4,
      categories: ['video']
    },
    {
      slug: 'partner-image',
      name: 'Partner Image',
      displayName: 'Partner Image',
      directory: 'partner_nodes',
      huggingFaceUrl: '',
      featured: false,
      workflowCount: 2,
      categories: ['image']
    },
    {
      slug: 'old-wan-video',
      canonicalSlug: 'wan-video',
      name: 'Old Wan Video',
      displayName: 'Old Wan Video',
      directory: 'diffusion_models',
      huggingFaceUrl: '',
      featured: false,
      workflowCount: 0,
      categories: ['video']
    }
  ])

  it('creates owned detail links and excludes redirect-only records', () => {
    expect(catalog.map(({ slug, href }) => ({ slug, href }))).toEqual([
      {
        slug: 'wan-video',
        href: '/p/supported-models/wan-video'
      },
      {
        slug: 'partner-image',
        href: '/p/supported-models/partner-image'
      }
    ])
  })

  it('filters by category and every normalized query term', () => {
    expect(
      filterModelExploreCatalog(catalog, 'wan safetensors', 'video').map(
        ({ slug }) => slug
      )
    ).toEqual(['wan-video'])
    expect(filterModelExploreCatalog(catalog, '', 'image')).toHaveLength(1)
  })

  it('filters local components and partner integrations by access type', () => {
    expect(
      filterModelExploreCatalog(catalog, '', 'all', 'open').map(
        ({ slug }) => slug
      )
    ).toEqual(['wan-video'])
    expect(
      filterModelExploreCatalog(catalog, '', 'all', 'partner').map(
        ({ slug }) => slug
      )
    ).toEqual(['partner-image'])
  })
})

describe('model category accuracy', () => {
  it('excludes shared workflow dependencies and image tools from 3D model results', () => {
    const results = filterModelExploreCatalog(
      createModelExploreCatalog(models),
      '',
      '3d'
    ).map((model) => model.title)
    expect(results).toContain('Hunyuan 3D')
    expect(results).toContain('Tripo 3D')
    expect(results).not.toEqual(
      expect.arrayContaining(['Qwen Image Vae', 'Qwen 2.5 Vl 7b FP8 scaled'])
    )
    expect(results).not.toContain('Qwen Image Edit 2511 BF16')
    expect(results).not.toContain('Birefnet')
    expect(results).not.toContain('Rt Detr V4 X Hgnet FP32')
  })
})
