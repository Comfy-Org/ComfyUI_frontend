import { afterEach, describe, expect, it, vi } from 'vitest'

import { isTextOverflowing } from './isTextOverflowing'

const CHAR_WIDTH = 10

function setup(text: string, contentWidth: number) {
  const el = document.createElement('span')
  el.textContent = text
  Object.defineProperty(el, 'clientWidth', {
    configurable: true,
    value: contentWidth
  })
  vi.spyOn(window, 'getComputedStyle').mockReturnValue(
    {} as CSSStyleDeclaration
  )
  vi.spyOn(
    HTMLSpanElement.prototype,
    'getBoundingClientRect'
  ).mockImplementation(function (this: HTMLSpanElement) {
    return { width: (this.textContent?.length ?? 0) * CHAR_WIDTH } as DOMRect
  })
  return el
}

describe('isTextOverflowing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when the text fits the content width', () => {
    const el = setup('KSampler', 200)
    expect(isTextOverflowing(el)).toBe(false)
  })

  it('returns true when the full text is wider than the content width', () => {
    const el = setup('ONNX Detector (SEGS/legacy) - use BBOXDetector', 120)
    expect(isTextOverflowing(el)).toBe(true)
  })

  it('returns false for a zero-width element', () => {
    const el = setup('anything', 0)
    expect(isTextOverflowing(el)).toBe(false)
  })
})
