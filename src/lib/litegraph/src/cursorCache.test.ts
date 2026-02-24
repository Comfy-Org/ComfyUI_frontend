import { describe, expect, it, vi } from 'vitest'

describe('cursor cache optimization', () => {
  function createCursorCache() {
    let lastCursor = ''
    return {
      update(cursor: string, element: HTMLElement) {
        if (cursor !== lastCursor) {
          lastCursor = cursor
          element.style.cursor = cursor
        }
      }
    }
  }

  function createMockElement() {
    let cursorValue = ''
    const setter = vi.fn((value: string) => {
      cursorValue = value
    })

    const element = document.createElement('div')
    Object.defineProperty(element.style, 'cursor', {
      get: () => cursorValue,
      set: setter
    })

    return { element, setter }
  }

  it('should only write to DOM when cursor value changes', () => {
    const cache = createCursorCache()
    const { element, setter } = createMockElement()

    cache.update('crosshair', element)
    cache.update('crosshair', element)
    cache.update('crosshair', element)

    expect(setter).toHaveBeenCalledTimes(1)
    expect(setter).toHaveBeenCalledWith('crosshair')
  })

  it('should write to DOM when cursor value differs', () => {
    const cache = createCursorCache()
    const { element, setter } = createMockElement()

    cache.update('default', element)
    cache.update('crosshair', element)
    cache.update('grabbing', element)

    expect(setter).toHaveBeenCalledTimes(3)
    expect(setter).toHaveBeenNthCalledWith(1, 'default')
    expect(setter).toHaveBeenNthCalledWith(2, 'crosshair')
    expect(setter).toHaveBeenNthCalledWith(3, 'grabbing')
  })

  it('should skip repeated values interspersed with changes', () => {
    const cache = createCursorCache()
    const { element, setter } = createMockElement()

    cache.update('default', element)
    cache.update('default', element)
    cache.update('grab', element)
    cache.update('grab', element)
    cache.update('default', element)

    expect(setter).toHaveBeenCalledTimes(3)
  })
})
