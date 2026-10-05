import { describe, expect, it } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'

import { useResumePlayback } from './useResumePlayback'

function playing(element: HTMLMediaElement, value: boolean) {
  Object.defineProperty(element, 'paused', { value: !value, writable: true })
}

describe('useResumePlayback', () => {
  it('carries the position across a renewed URL for the same asset', async () => {
    const element = document.createElement('video')
    playing(element, false)
    const assetId = ref<string | undefined>('asset-a')
    const url = ref('https://assets.example/a?sig=first')
    const { restore } = useResumePlayback(
      shallowRef<HTMLMediaElement | null>(element),
      () => assetId.value,
      () => url.value
    )

    element.currentTime = 4
    url.value = 'https://assets.example/a?sig=second'
    await nextTick()
    // Assigning src rewinds the element; the browser does this, not the caller.
    element.currentTime = 0
    restore()

    expect(element.currentTime).toBe(4)
  })

  it('starts from the beginning when the URL points at another asset', async () => {
    const element = document.createElement('video')
    playing(element, false)
    const assetId = ref<string | undefined>('asset-a')
    const url = ref('https://assets.example/a?sig=first')
    const { restore } = useResumePlayback(
      shallowRef<HTMLMediaElement | null>(element),
      () => assetId.value,
      () => url.value
    )

    element.currentTime = 4
    assetId.value = 'asset-b'
    url.value = 'https://assets.example/b?sig=first'
    await nextTick()
    element.currentTime = 0
    restore()

    expect(element.currentTime).toBe(0)
  })

  it('restores only once, so a later reload of the same URL starts clean', async () => {
    const element = document.createElement('video')
    playing(element, false)
    const assetId = ref<string | undefined>('asset-a')
    const url = ref('https://assets.example/a?sig=first')
    const { restore } = useResumePlayback(
      shallowRef<HTMLMediaElement | null>(element),
      () => assetId.value,
      () => url.value
    )

    element.currentTime = 4
    url.value = 'https://assets.example/a?sig=second'
    await nextTick()
    restore()
    element.currentTime = 0
    restore()

    expect(element.currentTime).toBe(0)
  })
})
