import { describe, expect, it, vi } from 'vitest'
import {
  fetchDroppedAsset,
  hasAudioType,
  hasImageType,
  hasVideoType,
  isMediaFile
} from './eventUtils'

describe('hasImageType', () => {
  it('should return true for image types', () => {
    expect(hasImageType({ type: 'image/png' } as File)).toBe(true)
    expect(hasImageType({ type: 'image/jpeg' } as File)).toBe(true)
  })

  it('should return false for non-image types', () => {
    expect(hasImageType({ type: 'audio/mpeg' } as File)).toBe(false)
    expect(hasImageType({ type: 'video/mp4' } as File)).toBe(false)
  })
})

describe('hasAudioType', () => {
  it('should return true for audio types', () => {
    expect(hasAudioType({ type: 'audio/mpeg' } as File)).toBe(true)
    expect(hasAudioType({ type: 'audio/wav' } as File)).toBe(true)
  })

  it('should return false for non-audio types', () => {
    expect(hasAudioType({ type: 'image/png' } as File)).toBe(false)
    expect(hasAudioType({ type: 'video/mp4' } as File)).toBe(false)
  })
})

describe('hasVideoType', () => {
  it('should return true for video types', () => {
    expect(hasVideoType({ type: 'video/mp4' } as File)).toBe(true)
    expect(hasVideoType({ type: 'video/webm' } as File)).toBe(true)
  })

  it('should return false for non-video types', () => {
    expect(hasVideoType({ type: 'audio/mpeg' } as File)).toBe(false)
    expect(hasVideoType({ type: 'image/png' } as File)).toBe(false)
  })
})

describe('isMediaFile', () => {
  it('should return true for image, audio, and video types', () => {
    expect(isMediaFile({ type: 'image/png' } as File)).toBe(true)
    expect(isMediaFile({ type: 'audio/mpeg' } as File)).toBe(true)
    expect(isMediaFile({ type: 'video/mp4' } as File)).toBe(true)
  })

  it('should return false for non-media types', () => {
    expect(isMediaFile({ type: 'text/plain' } as File)).toBe(false)
    expect(isMediaFile({ type: 'application/json' } as File)).toBe(false)
  })
})

describe('fetchDroppedAsset', () => {
  function stubFetch(resolvedUrl: string) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        url: resolvedUrl,
        blob: async () => new Blob(['x'], { type: 'image/png' })
      })
    )
  }

  /* The File's name is what uploadImage posts, so it becomes the uploaded ref
     and the name the seed shows the model — not just the chip's label. */
  it.for([
    [
      'a dotted content hash must not outrank the ref',
      'https://storage/bucket/0123456789abcdef0123456789abcdef.png',
      'cat.png'
    ],
    [
      'nor must an extensionless storage key',
      'https://storage/bucket/0123456789abcdef0123456789abcdef',
      'cat.png'
    ]
  ] as const)('%s', async ([, resolvedUrl, want]) => {
    stubFetch(resolvedUrl)
    const file = await fetchDroppedAsset({
      name: 'display label',
      uri: 'https://api/assets/abc/content',
      ref: 'cat.png'
    })
    expect(file?.name).toBe(want)
  })

  it('still prefers an explicit filename parameter over everything', async () => {
    stubFetch('https://storage/bucket/deadbeef.png?filename=real%20name.png')
    const file = await fetchDroppedAsset({
      name: 'display label',
      uri: 'https://api/assets/abc/content',
      ref: 'cat.png'
    })
    expect(file?.name).toBe('real name.png')
  })

  /* decodeURIComponent throws on a malformed escape, and it runs inside the
     fetch's try block — so one bad byte in a storage URL used to discard a blob
     that had already downloaded fine and report it as a failed retrieval. */
  it('keeps the file when the storage path has a malformed escape', async () => {
    stubFetch('https://storage/bucket/%E0%A4%A')
    const file = await fetchDroppedAsset({
      name: 'display label',
      uri: 'https://api/assets/abc/content',
      ref: 'cat.png'
    })
    expect(file?.name).toBe('cat.png')
  })

  it('still yields a file when only the malformed segment could name it', async () => {
    stubFetch('https://storage/bucket/%E0%A4%A.png')
    const file = await fetchDroppedAsset({
      name: 'fallback.bin',
      uri: 'https://api/assets/abc/content',
      ref: 'bare-ref'
    })
    expect(file).toBeDefined()
    expect(file?.name).toBe('%E0%A4%A.png')
  })

  it('falls back to the display label when nothing else carries an extension', async () => {
    stubFetch('https://storage/bucket/deadbeef')
    const file = await fetchDroppedAsset({
      name: 'fallback.png',
      uri: 'https://api/assets/abc/content',
      ref: 'bare-ref'
    })
    expect(file?.name).toBe('fallback.png')
  })
})
