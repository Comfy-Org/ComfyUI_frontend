import { fromPartial } from '@total-typescript/shoehorn'
import { createApp, h, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import type { Ref } from 'vue'

type ObserverInit = ConstructorParameters<typeof IntersectionObserver>[1]
type ObserverCallback = ConstructorParameters<typeof IntersectionObserver>[0]

const observers: MockIntersectionObserver[] = []

class MockIntersectionObserver {
  readonly callback: ObserverCallback
  readonly options?: ObserverInit
  readonly observe = vi.fn()
  readonly unobserve = vi.fn()
  readonly disconnect = vi.fn()

  constructor(callback: ObserverCallback, options?: ObserverInit) {
    this.callback = callback
    this.options = options
    observers.push(this)
  }
}

function mountObserver(
  target: Ref<Element | null>,
  callback: IntersectionObserverCallback,
  options: Parameters<typeof useIntersectionObserver>[2] = {}
) {
  let result: ReturnType<typeof useIntersectionObserver> | undefined
  const app = createApp({
    setup() {
      result = useIntersectionObserver(target, callback, options)
      return () => h('div')
    }
  })
  app.mount(document.createElement('div'))
  if (!result) throw new Error('useIntersectionObserver did not initialize')
  return {
    result,
    unmount: () => app.unmount()
  }
}

beforeEach(() => {
  observers.length = 0
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: MockIntersectionObserver
  })
})

describe('useIntersectionObserver', () => {
  it('observes the target immediately and updates intersection state', async () => {
    const target = ref<Element | null>(document.createElement('div'))
    const callback = vi.fn()

    const { result, unmount } = mountObserver(target, callback, {
      threshold: 0.5
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result.isSupported).toBe(true)
    expect(observers).toHaveLength(1)
    expect(observers[0].options).toMatchObject({ threshold: 0.5 })
    expect(observers[0].observe).toHaveBeenCalledWith(target.value)

    observers[0].callback(
      [
        { isIntersecting: false },
        { isIntersecting: true }
      ] as IntersectionObserverEntry[],
      fromPartial<IntersectionObserver>(observers[0])
    )

    expect(result.isIntersecting.value).toBe(true)
    expect(callback).toHaveBeenCalled()

    unmount()
    expect(observers[0].disconnect).toHaveBeenCalled()
  })

  it('supports manual observe, unobserve, and cleanup', () => {
    const target = ref<Element | null>(document.createElement('div'))
    const { result, unmount } = mountObserver(target, vi.fn(), {
      immediate: false
    })

    expect(observers).toHaveLength(0)

    result.observe()
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledWith(target.value)

    result.unobserve()
    expect(observers[0].unobserve).toHaveBeenCalledWith(target.value)

    result.cleanup()
    expect(observers[0].disconnect).toHaveBeenCalled()

    unmount()
  })

  it('does nothing when unsupported or missing a target', () => {
    Reflect.deleteProperty(window, 'IntersectionObserver')
    const unsupported = mountObserver(
      ref(document.createElement('div')),
      vi.fn(),
      {
        immediate: false
      }
    )

    unsupported.result.observe()

    expect(unsupported.result.isSupported).toBe(false)
    expect(observers).toHaveLength(0)
    unsupported.unmount()

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: MockIntersectionObserver
    })
    const missingTarget = mountObserver(ref<Element | null>(null), vi.fn(), {
      immediate: false
    })

    missingTarget.result.observe()

    expect(observers).toHaveLength(0)
    missingTarget.unmount()
  })
})
