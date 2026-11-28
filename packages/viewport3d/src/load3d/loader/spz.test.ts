import { describe, expect, it } from 'vitest'

import { isSpzV4 } from './spz'

function bytesOf(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer
}

describe('isSpzV4', () => {
  it.for([
    {
      name: 'raw NGSP header',
      bytes: bytesOf(0x4e, 0x47, 0x53, 0x50, 4, 0, 0, 0),
      expected: true
    },
    {
      name: 'gzip-wrapped SPZ (v1-3)',
      bytes: bytesOf(0x1f, 0x8b, 0x08, 0x00),
      expected: false
    },
    {
      name: 'PLY header',
      bytes: new TextEncoder().encode('ply\n').buffer,
      expected: false
    },
    {
      name: 'buffer shorter than the magic',
      bytes: bytesOf(0x4e, 0x47, 0x53),
      expected: false
    },
    { name: 'empty buffer', bytes: new ArrayBuffer(0), expected: false }
  ])('$name → $expected', ({ bytes, expected }) => {
    expect(isSpzV4(bytes)).toBe(expected)
  })
})
