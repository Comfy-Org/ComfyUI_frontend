import { describe, expect, it } from 'vitest'

import { paparazziRequest } from './contract'
import { DEFAULT_SETUP } from './setup'

describe('paparazziRequest', () => {
  it('sends the preset scene in words, the trimmed name and the seed', () => {
    expect(
      paparazziRequest('/face.jpg', {
        ...DEFAULT_SETUP,
        celebrity: '  Orion Vale ',
        scene: 'cafe',
        seed: 9
      })
    ).toEqual({
      faceUrl: '/face.jpg',
      celebrity: 'Orion Vale',
      scene: 'cafe',
      sceneDescription:
        'at a pavement café table in the afternoon, cups and a window behind',
      resolution: '2K',
      seed: 9
    })
  })

  it.for([
    {
      sceneOverride: '  a rooftop at dawn ',
      scene: 'custom',
      words: 'a rooftop at dawn'
    },
    { sceneOverride: '   ', scene: 'airport', words: undefined }
  ] as const)(
    'sends "$sceneOverride" as the $scene scene',
    ({ sceneOverride, scene, words }) => {
      const request = paparazziRequest('/face.jpg', {
        ...DEFAULT_SETUP,
        scene: 'airport',
        sceneOverride
      })
      expect(request.scene).toBe(scene)
      if (words) expect(request.sceneDescription).toBe(words)
      else expect(request.sceneDescription).toMatch(/airport terminal/)
    }
  )
})
