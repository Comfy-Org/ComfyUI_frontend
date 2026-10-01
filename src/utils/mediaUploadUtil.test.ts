import { describe, expect, it } from 'vitest'

import {
  hasFilenameExtension,
  isUploadableVideo
} from '@/utils/mediaUploadUtil'

describe('mediaUploadUtil', () => {
  it.for([
    { name: 'clip.mp4', expected: true },
    { name: 'extensionless', expected: false },
    { name: 'clip.', expected: false },
    { name: 'clip. ', expected: false },
    { name: 'clip.mp4 ', expected: false },
    { name: '.mp4', expected: false }
  ])('reports extension boundary for $name', ({ name, expected }) => {
    expect(hasFilenameExtension(new File([], name))).toBe(expected)
  })

  it('accepts only videos with a backend-compatible filename extension', () => {
    expect(
      isUploadableVideo(new File([], 'clip.mp4', { type: 'video/mp4' }))
    ).toBe(true)
    expect(
      isUploadableVideo(new File([], 'clip.mp4', { type: 'image/png' }))
    ).toBe(false)
  })
})
