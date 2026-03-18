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
    const { element, setter } = createMockElement()
    const setCursor = createCursorCache(element)

    setCursor('crosshair')
    setCursor('crosshair')
    setCursor('crosshair')

    expect(setter).toHaveBeenCalledTimes(1)
    expect(setter).toHaveBeenCalledWith('crosshair')
  })

  it('should write to DOM when cursor value differs', () => {
    const { element, setter } = createMockElement()
    const setCursor = createCursorCache(element)

    setCursor('default')
    setCursor('crosshair')
    setCursor('grabbing')

    expect(setter).toHaveBeenCalledTimes(3)
    expect(setter).toHaveBeenNthCalledWith(1, 'default')
    expect(setter).toHaveBeenNthCalledWith(2, 'crosshair')
    expect(setter).toHaveBeenNthCalledWith(3, 'grabbing')
  })

  it('should skip repeated values interspersed with changes', () => {
    const { element, setter } = createMockElement()
    const setCursor = createCursorCache(element)

    setCursor('default')
    setCursor('default')
    setCursor('grab')
    setCursor('grab')
    setCursor('default')

    expect(setter).toHaveBeenCalledTimes(3)
  })
})
