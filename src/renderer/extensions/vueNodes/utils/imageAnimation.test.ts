import { describe, expect, it } from 'vitest'

import { isAnimatedImage } from './imageAnimation'

function bytes(...parts: (string | number[])[]): Uint8Array {
  return Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === 'string'
        ? Array.from(new TextEncoder().encode(part))
        : part
    )
  )
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngChunk(type: string, length: number): (string | number[])[] {
  return [
    [0, 0, 0, length],
    type,
    Array.from({ length }, () => 0),
    [0, 0, 0, 0]
  ]
}

function webp(flags: number): Uint8Array {
  return bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8X', [10, 0, 0, 0, flags])
}

describe('isAnimatedImage', () => {
  it.for([
    { name: 'a GIF', image: bytes('GIF89a'), animated: true },
    {
      name: 'an APNG',
      image: bytes(
        PNG_SIGNATURE,
        ...pngChunk('IHDR', 13),
        ...pngChunk('acTL', 8),
        ...pngChunk('IDAT', 4)
      ),
      animated: true
    },
    {
      name: 'a still PNG with text metadata',
      image: bytes(
        PNG_SIGNATURE,
        ...pngChunk('IHDR', 13),
        ...pngChunk('tEXt', 20),
        ...pngChunk('IDAT', 4)
      ),
      animated: false
    },
    { name: 'an animated WebP', image: webp(0x02), animated: true },
    { name: 'an extended still WebP', image: webp(0x10), animated: false },
    {
      name: 'a simple WebP',
      image: bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8 '),
      animated: false
    },
    {
      name: 'an AVIF image sequence',
      image: bytes([0, 0, 0, 24], 'ftyp', 'avis', [0, 0, 0, 0], 'avif', 'avis'),
      animated: true
    },
    {
      name: 'a still AVIF',
      image: bytes([0, 0, 0, 20], 'ftyp', 'avif', [0, 0, 0, 0], 'mif1'),
      animated: false
    },
    { name: 'a JPEG', image: bytes([0xff, 0xd8, 0xff]), animated: false }
  ])('detects whether $name is animated', ({ image, animated }) => {
    expect(isAnimatedImage(image)).toBe(animated)
  })
})
