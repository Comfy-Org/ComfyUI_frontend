import { describe, expect, it, vi } from 'vitest'

import { reloadFailedMedia } from '@/utils/mediaReloadUtil'

function failedAt(position: number) {
  const media = document.createElement('audio')
  media.src = 'http://example.com/a.mp3'
  let current = position
  Object.defineProperty(media, 'currentTime', {
    get: () => current,
    set: (value: number) => {
      current = value
    }
  })
  vi.spyOn(media, 'load').mockImplementation(() => {
    current = 0
  })
  return { media, position: () => current }
}

describe('reloadFailedMedia', () => {
  it('reloads and seeks back to the failed position once metadata loads', () => {
    const { media, position } = failedAt(42)

    reloadFailedMedia(media)
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(position()).toBe(0)
    media.dispatchEvent(new Event('loadedmetadata'))

    expect(position()).toBe(42)
  })

  it('does not seek a replaced source', () => {
    const { media, position } = failedAt(42)

    reloadFailedMedia(media)
    media.src = 'http://example.com/b.mp3'
    media.dispatchEvent(new Event('loadedmetadata'))

    expect(position()).toBe(0)
  })

  it('keeps a position the user chose before metadata loaded', () => {
    const { media, position } = failedAt(42)

    reloadFailedMedia(media)
    media.currentTime = 10
    media.dispatchEvent(new Event('loadedmetadata'))

    expect(position()).toBe(10)
  })

  it('keeps a seek the user started before metadata loaded', () => {
    const { media, position } = failedAt(42)

    reloadFailedMedia(media)
    media.dispatchEvent(new Event('seeking'))
    media.dispatchEvent(new Event('loadedmetadata'))

    expect(position()).toBe(0)
  })
})
