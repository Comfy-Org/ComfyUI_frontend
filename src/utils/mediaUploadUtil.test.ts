import { describe, expect, it } from 'vitest'

import {
  hasFilenameExtension,
  isExtensionlessVideo,
  isExtensionlessVideoUpload,
  isUploadableVideo
} from '@/utils/mediaUploadUtil'

describe('mediaUploadUtil', () => {
  it.for([
    { name: 'clip.mp4', expected: true },
    { name: 'extensionless', expected: false },
    { name: 'clip.', expected: false },
    { name: 'clip. ', expected: false },
    { name: 'clip.mp4 ', expected: false },
    { name: '.mp4', expected: false },
    { name: 'clip..mp4', expected: true },
    { name: ' clip.mp4', expected: true }
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

  it('identifies only extensionless videos', () => {
    expect(
      isExtensionlessVideo(new File([], 'clip', { type: 'video/mp4' }))
    ).toBe(true)
    expect(
      isExtensionlessVideo(new File([], 'clip.mp4', { type: 'video/mp4' }))
    ).toBe(false)
    expect(
      isExtensionlessVideo(new File([], 'clip.png', { type: 'image/png' }))
    ).toBe(false)
    expect(
      isExtensionlessVideo(new File([], 'clip', { type: 'image/png' }))
    ).toBe(false)
  })

  it('treats an untyped extensionless file as a video on video routes', () => {
    // Browsers leave File.type empty when the name has no extension.
    expect(isExtensionlessVideo(new File([], 'clip'))).toBe(false)
    expect(isExtensionlessVideoUpload(new File([], 'clip'))).toBe(true)
    expect(
      isExtensionlessVideoUpload(new File([], 'clip', { type: 'video/mp4' }))
    ).toBe(true)
    expect(
      isExtensionlessVideoUpload(new File([], 'clip.mp4', { type: '' }))
    ).toBe(false)
    expect(
      isExtensionlessVideoUpload(new File([], 'clip', { type: 'image/png' }))
    ).toBe(false)
  })
})
