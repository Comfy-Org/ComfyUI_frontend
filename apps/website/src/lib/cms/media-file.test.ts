import { describe, expect, it } from 'vitest'

import {
  MAX_MEDIA_BYTES,
  mediaFileProblem,
  mediaKindOf,
  readMediaFile
} from '@/lib/cms/media-file'

describe('media files', () => {
  it('tells images from videos and refuses anything else', () => {
    expect(mediaKindOf('image/webp')).toBe('image')
    expect(mediaKindOf('video/mp4')).toBe('video')
    expect(mediaKindOf('application/pdf')).toBeUndefined()
    expect(mediaFileProblem({ type: 'application/pdf', size: 10 })).toBe('type')
  })

  it('refuses a file too large to save inline', () => {
    expect(
      mediaFileProblem({ type: 'image/png', size: MAX_MEDIA_BYTES + 1 })
    ).toBe('size')
    expect(
      mediaFileProblem({ type: 'image/png', size: MAX_MEDIA_BYTES })
    ).toBeUndefined()
  })

  it('reads a picked file into an inline link', async () => {
    const file = new File(['hello'], 'cover.png', { type: 'image/png' })
    await expect(readMediaFile(file)).resolves.toEqual({
      url: 'data:image/png;base64,aGVsbG8=',
      kind: 'image'
    })
  })
})
