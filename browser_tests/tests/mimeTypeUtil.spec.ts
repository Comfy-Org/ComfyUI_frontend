import { test, expect } from '@playwright/test'

import { getMimeType } from '@e2e/fixtures/utils/mimeTypeUtil'

// These tests verify the current state of getMimeType after audio MIME types
// (mp3, flac, ogg, opus) were removed in favour of 'application/octet-stream'.

test.describe('getMimeType', { tag: '@unit' }, () => {
  test.describe('image formats (still supported)', () => {
    test('returns image/png for .png files', () => {
      expect(getMimeType('photo.png')).toBe('image/png')
    })

    test('returns image/jpeg for .jpg files', () => {
      expect(getMimeType('photo.jpg')).toBe('image/jpeg')
    })

    test('returns image/jpeg for .jpeg files', () => {
      expect(getMimeType('photo.jpeg')).toBe('image/jpeg')
    })

    test('returns image/webp for .webp files', () => {
      expect(getMimeType('image.webp')).toBe('image/webp')
    })

    test('returns image/svg+xml for .svg files', () => {
      expect(getMimeType('icon.svg')).toBe('image/svg+xml')
    })

    test('returns image/avif for .avif files', () => {
      expect(getMimeType('image.avif')).toBe('image/avif')
    })
  })

  test.describe('video formats (still supported)', () => {
    test('returns video/webm for .webm files', () => {
      expect(getMimeType('video.webm')).toBe('video/webm')
    })

    test('returns video/mp4 for .mp4 files', () => {
      expect(getMimeType('video.mp4')).toBe('video/mp4')
    })
  })

  test.describe('other formats (still supported)', () => {
    test('returns application/json for .json files', () => {
      expect(getMimeType('data.json')).toBe('application/json')
    })

    test('returns model/gltf-binary for .glb files', () => {
      expect(getMimeType('model.glb')).toBe('model/gltf-binary')
    })
  })

  test.describe('audio formats (no longer supported — regression guard)', () => {
    // These formats were explicitly removed from getMimeType. They must now
    // fall through to the generic octet-stream default, not return audio/*
    // MIME types.

    test('returns application/octet-stream for .mp3 files', () => {
      expect(getMimeType('audio.mp3')).toBe('application/octet-stream')
    })

    test('returns application/octet-stream for .flac files', () => {
      expect(getMimeType('audio.flac')).toBe('application/octet-stream')
    })

    test('returns application/octet-stream for .ogg files', () => {
      expect(getMimeType('audio.ogg')).toBe('application/octet-stream')
    })

    test('returns application/octet-stream for .opus files', () => {
      expect(getMimeType('audio.opus')).toBe('application/octet-stream')
    })
  })

  test.describe('unknown / fallback extensions', () => {
    test('returns application/octet-stream for unknown extensions', () => {
      expect(getMimeType('file.xyz')).toBe('application/octet-stream')
    })

    test('returns application/octet-stream for files with no extension', () => {
      expect(getMimeType('README')).toBe('application/octet-stream')
    })

    test('returns application/octet-stream for empty string', () => {
      expect(getMimeType('')).toBe('application/octet-stream')
    })
  })

  test.describe('case insensitivity', () => {
    test('handles uppercase .PNG extension', () => {
      expect(getMimeType('IMAGE.PNG')).toBe('image/png')
    })

    test('handles uppercase .JPG extension', () => {
      expect(getMimeType('PHOTO.JPG')).toBe('image/jpeg')
    })

    test('handles uppercase .MP4 extension', () => {
      expect(getMimeType('VIDEO.MP4')).toBe('video/mp4')
    })

    test('handles uppercase .WEBM extension', () => {
      expect(getMimeType('VIDEO.WEBM')).toBe('video/webm')
    })

    // Boundary case: confirm audio formats are not supported regardless of case
    test('returns application/octet-stream for uppercase .MP3 extension', () => {
      expect(getMimeType('AUDIO.MP3')).toBe('application/octet-stream')
    })
  })

  test.describe('filenames with multiple dots', () => {
    test('resolves extension from last segment', () => {
      expect(getMimeType('my.file.name.png')).toBe('image/png')
    })

    test('returns octet-stream when final segment is not a known extension', () => {
      expect(getMimeType('archive.tar.gz')).toBe('application/octet-stream')
    })
  })
})
