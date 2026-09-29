import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'

import { useStickyFooterScrollPadding } from './useStickyFooterScrollPadding'

type ResizeCallback = (entries: Partial<ResizeObserverEntry>[]) => void

class FakeResizeObserver {
  static latest: FakeResizeObserver | undefined
  constructor(readonly callback: ResizeCallback) {
    FakeResizeObserver.latest = this
  }
  observe() {}
  disconnect() {}
  resize(blockSize: number) {
    this.callback([{ borderBoxSize: [{ blockSize, inlineSize: 320 }] }])
  }
}

const root = document.documentElement

describe('useStickyFooterScrollPadding', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    root.style.scrollPaddingBottom = '12px'
  })
  afterEach(() => {
    root.style.scrollPaddingBottom = ''
  })

  it('reserves the footer height while active and restores the page after', async () => {
    const active = ref(true)
    const scope = effectScope()
    scope.run(() =>
      useStickyFooterScrollPadding(
        shallowRef(document.createElement('div')),
        active
      )
    )

    FakeResizeObserver.latest?.resize(72.4)
    await nextTick()
    expect(root.style.scrollPaddingBottom).toBe('73px')

    active.value = false
    await nextTick()
    expect(root.style.scrollPaddingBottom).toBe('12px')

    active.value = true
    await nextTick()
    expect(root.style.scrollPaddingBottom).toBe('73px')

    scope.stop()
    expect(root.style.scrollPaddingBottom).toBe('12px')
  })

  it('leaves the page alone until the footer has a height', async () => {
    const scope = effectScope()
    scope.run(() =>
      useStickyFooterScrollPadding(
        shallowRef(document.createElement('div')),
        true
      )
    )
    await nextTick()

    expect(root.style.scrollPaddingBottom).toBe('12px')
    scope.stop()
  })
})
