import { describe, expect, it } from 'vitest'
import { decodePngBuffer } from '@e2e/fixtures/helpers/decodedImage'

const rgbPixels = [
  10, 70, 200, 255, 100, 30, 80, 255, 40, 240, 130, 255, 90, 20, 250, 255, 30,
  170, 60, 255, 220, 60, 180, 255
]
const rgbaPixels = [
  10, 70, 200, 19, 100, 30, 80, 60, 40, 240, 130, 90, 90, 20, 250, 120, 30, 170,
  60, 150, 220, 60, 180, 180
]

describe('PNG evidence decoding', () => {
  it.for([
    [
      'RGB None',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAHElEQVR4nGPgcjuRIheg8aGJIUrkl9wqmzs2WwBFnAe9wJTrUgAAAABJRU5ErkJggg==',
      rgbPixels
    ],
    [
      'RGB Sub',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAHUlEQVR4nGPkcjsRdaPjyCUjxiiRX0emOe2bVAEAWdIJae0/VCYAAAAASUVORK5CYII=',
      rgbPixels
    ],
    [
      'RGB Up',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAHElEQVR4nGPicjuRIheg8aGJKeCc0a6eN1t8jABKzgg9feGTJQAAAABJRU5ErkJggg==',
      rgbPixels
    ],
    [
      'RGB Average',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAHUlEQVR4nGPmcjsR//vNt4dRzKEfp+2fOH1nfigAa30K1v+FKXsAAAAASUVORK5CYII=',
      rgbPixels
    ],
    [
      'RGB Paeth',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAHUlEQVR4nGPhcjsRdaPjyCUjloBzRrumvdnnYwQAW8QJa3uYxRgAAAAASUVORK5CYII=',
      rgbPixels
    ],
    [
      'RGBA None',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAI0lEQVR4nGPgcjshnCIXYKPxoSmKIUrkV4XcKptpd2y2bAEAcWAKKP0+LcYAAAAASUVORK5CYII=',
      rgbaPixels
    ],
    [
      'RGBA Sub',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAI0lEQVR4nGPkcjshHHWjQ/PIJSM5xiiRXxVHpjnJ7ZtUIQcAhH8Kd4MeSREAAAAASUVORK5CYII=',
      rgbaPixels
    ],
    [
      'RGBA Up',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAIklEQVR4nGPicjshnCIXYKPxoSmKKeCcUequnjdRW3yMogB17Qn/VQk8LgAAAABJRU5ErkJggg==',
      rgbaPixels
    ],
    [
      'RGBA Average',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAI0lEQVR4nGPmcjshHP/7jfG3h1E2zKEfp+XvnzjdZmd+qA0Anv4MP/v3FVoAAAAASUVORK5CYII=',
      rgbaPixels
    ],
    [
      'RGBA Paeth',
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAI0lEQVR4nGPhcjshHHWjQ/PIJSM5loBzRqm7pr2R2+djJAcAhk0KZvPtfm8AAAAASUVORK5CYII=',
      rgbaPixels
    ]
  ] satisfies [string, string, number[]][])(
    'decodes known pixels from %s',
    ([_name, png, expected]) => {
      const image = decodePngBuffer(Buffer.from(png, 'base64'))
      expect([image.width, image.height]).toEqual([3, 2])
      expect([...image.rgba]).toEqual(expected)
    }
  )
})
