import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TextTicker from './TextTicker.vue'

function mockOverflow(
  el: HTMLElement,
  { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }
) {
  Object.defineProperty(el, 'scrollWidth', {
    value: scrollWidth,
    configurable: true
  })
  Object.defineProperty(el, 'clientWidth', {
    value: clientWidth,
    configurable: true
  })
}

describe('TextTicker', () => {
  let rafCallbacks: ((time: number) => void)[]

  beforeEach(() => {
    rafCallbacks = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders slot content', () => {
    const wrapper = mount(TextTicker, {
      slots: { default: 'Hello World' }
    })
    expect(wrapper.text()).toBe('Hello World')
  })

  it('scrolls on hover when content overflows', async () => {
    const wrapper = mount(TextTicker, {
      slots: { default: 'Very long text that overflows' },
      props: { speed: 100 }
    })

    const el = wrapper.element as HTMLElement
    mockOverflow(el, { scrollWidth: 300, clientWidth: 100 })

    // Allow useElementHover to set up listeners after mount
    await nextTick()
    await wrapper.trigger('mouseenter')
    await nextTick()

    expect(rafCallbacks.length).toBeGreaterThan(0)

    // Simulate animation frame - should set scrollLeft
    rafCallbacks[0](performance.now() + 500)
    expect(el.scrollLeft).toBeGreaterThan(0)
  })

  it('resets scroll position on mouse leave', async () => {
    const wrapper = mount(TextTicker, {
      slots: { default: 'Very long text that overflows' },
      props: { speed: 100 }
    })

    const el = wrapper.element as HTMLElement
    mockOverflow(el, { scrollWidth: 300, clientWidth: 100 })

    await nextTick()
    await wrapper.trigger('mouseenter')
    await nextTick()

    rafCallbacks[0](performance.now() + 500)
    expect(el.scrollLeft).toBeGreaterThan(0)

    await wrapper.trigger('mouseleave')
    await nextTick()

    expect(el.scrollLeft).toBe(0)
  })

  it('does not scroll when content fits', async () => {
    const wrapper = mount(TextTicker, {
      slots: { default: 'Short' }
    })

    const el = wrapper.element as HTMLElement
    mockOverflow(el, { scrollWidth: 50, clientWidth: 100 })

    await nextTick()
    await wrapper.trigger('mouseenter')
    await nextTick()

    expect(rafCallbacks.length).toBe(0)
  })
})
