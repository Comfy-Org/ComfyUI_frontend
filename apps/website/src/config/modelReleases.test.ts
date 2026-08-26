import { describe, expect, it } from 'vitest'

import type { Model } from './models'
import { createModelReleases } from './modelReleases'

function model(overrides: Partial<Model> & Pick<Model, 'slug'>): Model {
  return {
    name: `${overrides.slug}.safetensors`,
    displayName: overrides.slug,
    directory: 'diffusion_models',
    huggingFaceUrl: '',
    featured: false,
    workflowCount: 0,
    categories: ['video'],
    workflowPreviews: [],
    ...overrides
  }
}

describe('createModelReleases', () => {
  it('groups release components but leaves auxiliary components out of discovery', () => {
    const releases = createModelReleases([
      model({
        slug: 'wan-high',
        displayName: 'Wan2.2 I2V High Noise 14B FP8 scaled',
        workflowPreviews: [
          {
            id: 'wan-i2v',
            title: 'Wan image to video',
            thumbnailUrl: '/wan.webp',
            publishedAt: '2026-01-02T00:00:00.000Z'
          }
        ]
      }),
      model({
        slug: 'wan-low',
        displayName: 'Wan2.2 I2V Low Noise 14B FP8 scaled',
        workflowPreviews: [
          {
            id: 'wan-i2v',
            title: 'Wan image to video',
            thumbnailUrl: '/wan.webp',
            publishedAt: '2026-01-02T00:00:00.000Z'
          }
        ]
      }),
      model({
        slug: 'wan-vae',
        displayName: 'Wan VAE',
        directory: 'vae',
        workflowPreviews: [
          {
            id: 'wan-i2v',
            title: 'Wan image to video',
            thumbnailUrl: '/wan.webp'
          }
        ]
      })
    ])

    expect(releases).toHaveLength(1)
    expect(releases[0]).toMatchObject({
      familySlug: 'wan',
      displayName: 'Wan2.2 I2V 14B',
      publisher: 'Alibaba',
      access: 'open',
      releaseDate: '2026-01-02T00:00:00.000Z',
      thumbnailUrl: '/wan.webp'
    })
    expect(
      releases[0].components.map(({ slug, role }) => [slug, role])
    ).toEqual([
      ['wan-high', 'primary'],
      ['wan-low', 'primary'],
      ['wan-vae', 'decoder']
    ])
  })

  it('keeps identical workflow sets separate across model families', () => {
    const sharedWorkflow = {
      id: 'shared-3d-workflow',
      title: 'Image to 3D',
      thumbnailUrl: '/3d.webp'
    }
    const releases = createModelReleases([
      model({
        slug: 'trellis',
        displayName: 'Trellis 2',
        categories: ['3d'],
        workflowPreviews: [sharedWorkflow]
      }),
      model({
        slug: 'pixal',
        displayName: 'Pixal3D',
        categories: ['3d'],
        workflowPreviews: [sharedWorkflow]
      })
    ])

    expect(releases.map(({ slug }) => slug)).toEqual(['trellis', 'pixal'])
  })

  it('represents partner providers as partner-access releases', () => {
    const releases = createModelReleases([
      model({
        slug: 'kling-ai',
        displayName: 'Kling AI',
        directory: 'partner_nodes',
        categories: ['video']
      })
    ])

    expect(releases[0]).toMatchObject({
      slug: 'kling-ai',
      familySlug: 'kling',
      publisher: 'Kuaishou',
      access: 'partner'
    })
  })
})
