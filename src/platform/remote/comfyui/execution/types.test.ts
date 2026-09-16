import { expect, it } from 'vitest'

import { zTaskOutput } from './types'

it('preserves custom node output alongside partial media references', () => {
  expect(
    zTaskOutput.parse({
      '17': {
        images: [{ filename: 'preview.png', type: 'temp' }],
        text: 'caption',
        custom_mesh: { vertices: [2, 5, 11] }
      }
    })
  ).toEqual({
    '17': {
      images: [{ filename: 'preview.png', type: 'temp' }],
      text: 'caption',
      custom_mesh: { vertices: [2, 5, 11] }
    }
  })
})
