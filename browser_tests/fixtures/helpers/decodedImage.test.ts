import { describe, expect, it } from 'vitest'

import { decodePngBuffer } from '@e2e/fixtures/helpers/decodedImage'

describe('decodePngBuffer', () => {
  it('decodes Paeth pixels when the upper-left predictor is closest', () => {
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAHElEQVR4nGNICRCZpvGMa4sby/6AfRW7wiqiKwBLpQgVrBVOcQAAAABJRU5ErkJggg=='

    expect(decodePngBuffer(Buffer.from(png, 'base64'))).toEqual({
      width: 3,
      height: 2,
      rgba: Buffer.from([
        100, 80, 20, 255, 150, 40, 230, 255, 10, 180, 70, 255, 35, 160, 210,
        255, 220, 90, 60, 255, 130, 15, 180, 255
      ])
    })
  })
})
