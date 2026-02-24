import { describe, expect, it } from 'vitest'
import { hasAudioType, hasImageType } from './eventUtils'

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
