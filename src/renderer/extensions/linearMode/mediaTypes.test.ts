import { describe, expect, it } from 'vitest'

import type { ResultItemImpl } from '@/stores/queueStore'
import { getMediaType } from '@/renderer/extensions/linearMode/mediaTypes'

describe('getMediaType', () => {
  it('returns empty string for undefined output', () => {
    expect(getMediaType(undefined)).toBe('')
  })

  it('returns video when output isVideo', () => {
    const output = {
      isVideo: true,
      mediaType: 'images'
    } as unknown as ResultItemImpl
    expect(getMediaType(output)).toBe('video')
  })

  it('returns mediaType when output is not video', () => {
    const output = {
      isVideo: false,
      mediaType: 'audio'
    } as unknown as ResultItemImpl
    expect(getMediaType(output)).toBe('audio')
  })
})
