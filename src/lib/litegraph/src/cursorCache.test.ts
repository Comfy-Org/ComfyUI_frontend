import { describe, expect, it, vi } from 'vitest'

import { createCursorCache } from './cursorCache'

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

describe('createCursorCache', () => {
  it('should only write to DOM when cursor value changes', () => {
    const setCursor = createCursorCache()
    const { element, setter } = createMockElement()

    setCursor('crosshair', element)
    setCursor('crosshair', element)
    setCursor('crosshair', element)

    expect(setter).toHaveBeenCalledTimes(1)
    expect(setter).toHaveBeenCalledWith('crosshair')
  })

  it('should write to DOM when cursor value differs', () => {
    const setCursor = createCursorCache()
    const { element, setter } = createMockElement()

    setCursor('default', element)
    setCursor('crosshair', element)
    setCursor('grabbing', element)

    expect(setter).toHaveBeenCalledTimes(3)
    expect(setter).toHaveBeenNthCalledWith(1, 'default')
    expect(setter).toHaveBeenNthCalledWith(2, 'crosshair')
    expect(setter).toHaveBeenNthCalledWith(3, 'grabbing')
  })

  it('should skip repeated values interspersed with changes', () => {
    const setCursor = createCursorCache()
    const { element, setter } = createMockElement()

    setCursor('default', element)
    setCursor('default', element)
    setCursor('grab', element)
    setCursor('grab', element)
    setCursor('default', element)

    expect(setter).toHaveBeenCalledTimes(3)
  })
})
