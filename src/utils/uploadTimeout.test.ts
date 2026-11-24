import { describe, expect, it } from 'vitest'

import { uploadTimeoutMs } from '@/utils/uploadTimeout'

describe('uploadTimeoutMs', () => {
  it('keeps the 120 s floor for an empty file', () => {
    expect(uploadTimeoutMs(0)).toBe(120_000)
  })

  it('gives a 150 MB file time at 256 KiB/s', () => {
    expect(uploadTimeoutMs(150_000_000)).toBe(120_000 + 572_205)
  })
})
