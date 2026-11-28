import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadTimeoutMs } from '@/utils/uploadTimeout'

const distribution = vi.hoisted(() => ({ isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => distribution)

function fileOfBytes(bytes: number): File {
  return new File([new Uint8Array(bytes)], 'image.png')
}

describe('uploadTimeoutMs', () => {
  afterEach(() => {
    distribution.isDesktop = false
  })

  it.for([
    { label: 'nothing to send', bytes: [], expected: 120_000 },
    { label: 'an empty file', bytes: [0], expected: 120_000 },
    { label: 'one 1 byte file', bytes: [1], expected: 120_001 },
    { label: 'one 2.5 MiB file', bytes: [2_621_440], expected: 130_000 },
    {
      label: 'two concurrent 2.5 MiB files',
      bytes: [2_621_440, 2_621_440],
      expected: 140_000
    }
  ])(
    'allows 120 s plus 256 KiB/s of the batch for $label',
    ({ bytes, expected }) => {
      expect(uploadTimeoutMs(bytes.map(fileOfBytes))).toBe(expected)
    }
  )

  it('keeps the 120 s floor on desktop, where the server is on the same machine', () => {
    distribution.isDesktop = true

    expect(uploadTimeoutMs([fileOfBytes(2_621_440)])).toBe(120_000)
  })
})
