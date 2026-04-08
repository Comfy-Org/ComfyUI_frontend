import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TextTicker from './TextTicker.vue'

function mockScrollWidth(el: HTMLElement, scrollWidth: number) {
  Object.defineProperty(el, 'scrollWidth', {
    value: scrollWidth,
    configurable: true
  })
}

describe(TextTicker, () => {
  let rafCallbacks: ((time: number) => void)[]
  let user: ReturnType<typeof userEvent.setup>
  let unmount: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    rafCallbacks = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  })

  afterEach(() => {
    unmount?.()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders slot content', () => {
    ;({ unmount } = render(TextTicker, {
      slots: { default: 'Hello World' }
    }))
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('scrolls on hover after delay', async () => {
    ;({ unmount } = render(TextTicker, {
      slots: { default: 'Very long text that overflows' },
      props: { speed: 100 }
    }))

    const el = screen.getByText('Very long text that overflows')
    mockScrollWidth(el, 300)

    await nextTick()
    await user.hover(el)
    await nextTick()

    expect(rafCallbacks.length).toBe(0)

    vi.advanceTimersByTime(350)
    await nextTick()
    expect(rafCallbacks.length).toBeGreaterThan(0)

    rafCallbacks[0](performance.now() + 500)
    expect(el.scrollLeft).toBeGreaterThan(0)
  })

  it('cancels delayed scroll on mouse leave before delay elapses', async () => {
    ;({ unmount } = render(TextTicker, {
      slots: { default: 'Very long text that overflows' },
      props: { speed: 100 }
    }))

    const el = screen.getByText('Very long text that overflows')
    mockScrollWidth(el, 300)

    await nextTick()
    await user.hover(el)
    await nextTick()

    vi.advanceTimersByTime(200)
    await user.unhover(el)
    await nextTick()

    vi.advanceTimersByTime(350)
    await nextTick()
    expect(rafCallbacks.length).toBe(0)
  })

  it('resets scroll position on mouse leave', async () => {
    ;({ unmount } = render(TextTicker, {
      slots: { default: 'Very long text that overflows' },
      props: { speed: 100 }
    }))

    const el = screen.getByText('Very long text that overflows')
    mockScrollWidth(el, 300)

    await nextTick()
    await user.hover(el)
    await nextTick()
    vi.advanceTimersByTime(350)
    await nextTick()

    rafCallbacks[0](performance.now() + 500)
    expect(el.scrollLeft).toBeGreaterThan(0)

    await user.unhover(el)
    await nextTick()

    expect(el.scrollLeft).toBe(0)
  })

  it('does not scroll when content fits', async () => {
    ;({ unmount } = render(TextTicker, {
      slots: { default: 'Short' }
    }))

    const el = screen.getByText('Short')

    await nextTick()
    await user.hover(el)
    await nextTick()
    vi.advanceTimersByTime(350)
    await nextTick()

    expect(rafCallbacks.length).toBe(0)
  })
})
