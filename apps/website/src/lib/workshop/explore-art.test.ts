import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { CatalogueApp } from './catalogue-apps'
import { doorArt } from './explore-art'

const model = (
  slug: string,
  thumbnail?: WorkshopModel['thumbnail'],
  creditsPerRun?: number
): WorkshopModel => ({
  routerId: `acme/${slug}`,
  slug,
  name: `Name of ${slug}`,
  workflowCount: 0,
  capabilities: [],
  thumbnail,
  creditsPerRun
})

const app = (key: string, thumbnail?: CatalogueApp['thumbnail']) => ({
  key,
  name: key,
  task: '',
  href: `/hub/${key}/`,
  thumbnail
})

const NANO = 'vertexai--gemini-3-pro-image--generate-images'
const RUNWAY = 'runway--gen4-image--generate-images'

describe('door art', () => {
  it('fronts each door with the first candidate the catalogue holds', () => {
    expect(
      doorArt({
        models: [
          model(RUNWAY, { url: '/rowboat.png', kind: 'image' }, 6),
          {
            ...model(NANO, { url: '/lake.png', kind: 'image' }, 9),
            provider: 'Google'
          }
        ],
        workflows: [
          model('workflows/product-in-scene', {
            url: '/bottle.webp',
            kind: 'image'
          })
        ],
        apps: [
          app('apps/reshoot', {
            url: '/reshoot.mp4',
            kind: 'video',
            poster: '/reshoot.jpg'
          })
        ]
      })
    ).toEqual({
      models: {
        src: '/lake.png',
        name: `Name of ${NANO}`,
        provider: 'Google',
        credits: 9,
        prompt: 'workshop.explore.doorModelPromptLake'
      },
      workflows: { src: '/bottle.webp' },
      apps: {
        src: '/images/cinematic-studio/train.jpg',
        control: 'workshop.explore.doorAppControlRotation',
        value: '35°'
      }
    })
  })

  it.for([
    ['has no still', model(NANO, { url: '/clip.mp4', kind: 'video' })],
    ['has no art', model(NANO)]
  ] as const)('passes over a candidate that %s', ([, unusable]) => {
    expect(
      doorArt({
        models: [unusable, model(RUNWAY, { url: '/row.png', kind: 'image' })],
        workflows: [],
        apps: []
      }).models
    ).toMatchObject({
      src: '/row.png',
      prompt: 'workshop.explore.doorModelPromptRowboat'
    })
  })

  it('names a model without the task its card already shows', () => {
    expect(
      doorArt({
        models: [
          {
            ...model(NANO, { url: '/lake.png', kind: 'image' }),
            name: 'Nano Banana Pro Text-to-Image',
            task: 'text-to-image'
          }
        ],
        workflows: [],
        apps: []
      }).models?.name
    ).toBe('Nano Banana Pro')
  })

  it('leaves a door bare when the catalogue holds none of its candidates', () => {
    expect(
      doorArt({
        models: [model('other', { url: '/other.png', kind: 'image' })],
        workflows: [],
        apps: [app('apps/elsewhere', { url: '/x.jpg', kind: 'image' })]
      })
    ).toEqual({})
  })
})
