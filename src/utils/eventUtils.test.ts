import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'
import {
  extractFilesFromDragEvent,
  hasAudioType,
  hasImageType,
  hasVideoType,
  isMediaFile,
  withHdrImageType
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

describe('withHdrImageType', () => {
  it.for([
    ['sky.exr', 'image/x-exr'],
    ['SKY.HDR', 'image/vnd.radiance']
  ])('types an untyped %s as %s', ([name, type]) => {
    const typed = withHdrImageType(new File(['data'], name))

    expect(typed.type).toBe(type)
    expect(typed.name).toBe(name)
  })

  it('leaves typed and non-HDR files alone', () => {
    const typed = new File(['data'], 'sky.exr', { type: 'image/x-exr' })
    const other = new File(['data'], 'notes.txt')

    expect(withHdrImageType(typed)).toBe(typed)
    expect(withHdrImageType(other)).toBe(other)
  })
})

describe('extractFilesFromDragEvent', () => {
  it('returns an untyped .exr drop as an image', async () => {
    const event = fromAny<DragEvent, unknown>({
      dataTransfer: { files: [new File(['data'], 'sky.exr')] }
    })

    const [file] = await extractFilesFromDragEvent(event)

    expect(hasImageType(file)).toBe(true)
  })
})
