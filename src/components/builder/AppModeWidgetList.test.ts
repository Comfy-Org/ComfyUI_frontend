import { nextTick, shallowRef, watch } from 'vue'
import { describe, expect, it, vi } from 'vitest'

describe('resize tracking reactivity', () => {
  // Reproduces the tracking pattern from AppModeWidgetList
  function createTracker() {
    const resizablesByKey = new Map<string, { el: HTMLElement; key: string }>()
    const resizablesByEl = new WeakMap<
      HTMLElement,
      { el: HTMLElement; key: string }
    >()
    const observedElements = shallowRef<HTMLElement[]>([])

    function syncObservedElements() {
      observedElements.value = [...resizablesByKey.values()].map((r) => r.el)
    }

    function track(el: HTMLElement | null, key: string) {
      const prev = resizablesByKey.get(key)
      if (prev) resizablesByEl.delete(prev.el)
      resizablesByKey.delete(key)

      if (!el) {
        syncObservedElements()
        return
      }

      const entry = { el, key }
      resizablesByKey.set(key, entry)
      resizablesByEl.set(el, entry)
      syncObservedElements()
    }

    return { observedElements, resizablesByEl, track }
  }

  it('updates observedElements when a new element is tracked', () => {
    const { observedElements, track } = createTracker()
    const el = document.createElement('textarea')

    track(el, '1:prompt')

    expect(observedElements.value).toEqual([el])
  })

  it('removes element from observedElements on untrack', () => {
    const { observedElements, track } = createTracker()
    const el = document.createElement('textarea')

    track(el, '1:prompt')
    track(null, '1:prompt')

    expect(observedElements.value).toEqual([])
  })

  it('cleans up WeakMap when replacing an element for the same key', () => {
    const { resizablesByEl, track } = createTracker()
    const el1 = document.createElement('textarea')
    const el2 = document.createElement('textarea')

    track(el1, '1:prompt')
    expect(resizablesByEl.has(el1)).toBe(true)

    track(el2, '1:prompt')
    expect(resizablesByEl.has(el1)).toBe(false)
    expect(resizablesByEl.has(el2)).toBe(true)
  })

  it('triggers Vue watchers when elements change', async () => {
    const { observedElements, track } = createTracker()
    const spy = vi.fn()
    watch(observedElements, spy)

    track(document.createElement('textarea'), '1:prompt')
    await nextTick()

    expect(spy).toHaveBeenCalledOnce()
  })
})
