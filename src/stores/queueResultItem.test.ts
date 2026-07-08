import { describe, expect, it, vi } from 'vitest'

import type { SerializedNodeId } from '@/types/nodeId'
import { ResultItemImpl } from '@/stores/queueStore'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `http://localhost:8188${path}`,
    addEventListener: () => {}
  }
}))

// Importing ResultItemImpl transitively loads @/scripts/app, whose module-level
// ComfyApp singleton wires real listeners. Stub it; ResultItemImpl needs none of it.
vi.mock('@/scripts/app', () => ({ app: {} }))

// Keep preview-url assertions deterministic: don't append cloud params.
vi.mock('@/platform/distribution/cloudPreviewUtil', () => ({
  appendCloudResParam: () => {}
}))

interface ItemOverrides {
  filename?: string
  mediaType?: string
  format?: string
  frame_rate?: number
}

function item(over: ItemOverrides = {}) {
  return new ResultItemImpl({
    filename: over.filename ?? 'out.png',
    subfolder: 'sub',
    type: 'output',
    nodeId: '1' as SerializedNodeId,
    mediaType: over.mediaType ?? 'images',
    format: over.format,
    frame_rate: over.frame_rate
  })
}

describe('ResultItemImpl', () => {
  it('builds view url params and omits absent vhs fields', () => {
    const params = item({ filename: 'a.png' }).urlParams
    expect(params.get('filename')).toBe('a.png')
    expect(params.get('type')).toBe('output')
    expect(params.get('subfolder')).toBe('sub')
    expect(params.has('format')).toBe(false)
    expect(params.has('frame_rate')).toBe(false)
  })

  it('includes vhs format and frame_rate params when present', () => {
    const params = item({ format: 'video/h264-mp4', frame_rate: 24 }).urlParams
    expect(params.get('format')).toBe('video/h264-mp4')
    expect(params.get('frame_rate')).toBe('24')
  })

  it('returns an empty url for a nameless item and a view url otherwise', () => {
    expect(item({ filename: '' }).url).toBe('')
    expect(item({ filename: 'a.png' }).url).toContain('/view?')
  })

  it('routes image preview urls through /view', () => {
    expect(
      item({ filename: 'a.png', mediaType: 'images' }).previewUrl
    ).toContain('/view?')
  })

  it('falls back to url directly for non-image preview urls', () => {
    const nonImage = item({ filename: 'a.mp3', mediaType: 'audio' })
    expect(nonImage.previewUrl).toBe(nonImage.url)
  })

  it('exposes the vhs advanced preview endpoint', () => {
    expect(item().vhsAdvancedPreviewUrl).toContain('/viewvideo?')
  })

  it('maps html video mime types by suffix and vhs format', () => {
    expect(item({ filename: 'a.webm' }).htmlVideoType).toBe('video/webm')
    expect(item({ filename: 'a.mp4' }).htmlVideoType).toBe('video/mp4')
    expect(item({ filename: 'a.mov' }).htmlVideoType).toBe('video/quicktime')
    expect(
      item({ filename: 'a.bin', format: 'video/mp4', frame_rate: 24 })
        .htmlVideoType
    ).toBe('video/mp4')
    expect(
      item({ filename: 'a.bin', format: 'video/webm', frame_rate: 24 })
        .htmlVideoType
    ).toBe('video/webm')
    expect(item({ filename: 'a.txt' }).htmlVideoType).toBeUndefined()
  })

  it('maps html audio mime types by suffix', () => {
    expect(item({ filename: 'a.mp3' }).htmlAudioType).toBe('audio/mpeg')
    expect(item({ filename: 'a.wav' }).htmlAudioType).toBe('audio/wav')
    expect(item({ filename: 'a.ogg' }).htmlAudioType).toBe('audio/ogg')
    expect(item({ filename: 'a.flac' }).htmlAudioType).toBe('audio/flac')
    expect(item({ filename: 'a.png' }).htmlAudioType).toBeUndefined()
  })

  it('treats vhs format as such only with both format and frame_rate', () => {
    expect(item({ format: 'video/mp4', frame_rate: 24 }).isVhsFormat).toBe(true)
    expect(item({ format: 'video/mp4' }).isVhsFormat).toBe(false)
    expect(item({ frame_rate: 24 }).isVhsFormat).toBe(false)
    expect(item().isVhsFormat).toBe(false)
  })

  it('classifies video by suffix and by media type', () => {
    expect(item({ filename: 'a.webm' }).isVideo).toBe(true)
    expect(item({ filename: 'a.bin', mediaType: 'video' }).isVideo).toBe(true)
    expect(item({ filename: 'a.png', mediaType: 'video' }).isVideo).toBe(false)
  })

  it('classifies image only when not contradicted by a media suffix', () => {
    expect(item({ filename: 'a.png', mediaType: 'images' }).isImage).toBe(true)
    expect(item({ filename: 'a.webm', mediaType: 'images' }).isImage).toBe(
      false
    )
  })

  it('classifies audio by suffix and by media type', () => {
    expect(item({ filename: 'a.mp3' }).isAudio).toBe(true)
    expect(item({ filename: 'a.bin', mediaType: 'audio' }).isAudio).toBe(true)
    expect(item({ filename: 'a.png', mediaType: 'audio' }).isAudio).toBe(false)
  })

  it('reports text and preview support', () => {
    expect(item({ mediaType: 'text' }).isText).toBe(true)
    expect(item({ filename: 'a.png' }).supportsPreview).toBe(true)
    expect(
      item({ filename: 'a.bin', mediaType: 'binary' }).supportsPreview
    ).toBe(false)
  })

  it('filters previewable outputs and finds an item by url', () => {
    const png = item({ filename: 'a.png' })
    const bin = item({ filename: 'a.bin', mediaType: 'binary' })
    expect(ResultItemImpl.filterPreviewable([png, bin])).toEqual([png])

    // A genuine match returns the matched index (1 here, distinguishing it
    // from the index-0 fallback used for no-match and missing-url cases).
    expect(ResultItemImpl.findByUrl([bin, png], png.url)).toBe(1)
    expect(ResultItemImpl.findByUrl([bin, png], 'no-match')).toBe(0)
    expect(ResultItemImpl.findByUrl([bin, png])).toBe(0)
  })
})
