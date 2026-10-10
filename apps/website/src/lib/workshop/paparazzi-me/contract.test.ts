import { describe, expect, it } from 'vitest'

import { paparazziRequest } from './contract'
import { DEFAULT_SETUP } from './setup'

describe('paparazziRequest', () => {
  it.for([
    {
      name: 'a picked candidate as sceneToken',
      scene: { token: 'orion-vale/yacht' },
      fields: { sceneToken: 'orion-vale/yacht' }
    },
    {
      name: 'an uploaded scene as scene, without a token',
      scene: { upload: 'blob:scene' },
      fields: { scene: 'blob:scene' }
    },
    { name: 'neither before a look-up', scene: undefined, fields: {} }
  ])('sends $name', ({ scene, fields }) => {
    expect(
      paparazziRequest(
        '/face.jpg',
        { ...DEFAULT_SETUP, celebrity: '  Orion Vale ', seed: 9 },
        scene
      )
    ).toEqual({
      user: '/face.jpg',
      celebrity: 'Orion Vale',
      resolution: '2K',
      seed: 9,
      ...fields
    })
  })
})
