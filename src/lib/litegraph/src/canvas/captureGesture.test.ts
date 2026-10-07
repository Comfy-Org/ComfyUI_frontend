import { describe, expect, it, vi } from 'vitest'

import { loseCapture } from '@/lib/litegraph/src/__fixtures__/canvasHarness'

import { captureGesture } from './captureGesture'

describe('captureGesture', () => {
  it('captures the pointer until released', () => {
    const element = document.createElement('div')

    const release = captureGesture(element, 1, vi.fn())
    expect(element.hasPointerCapture(1)).toBe(true)

    release()
    expect(element.hasPointerCapture(1)).toBe(false)
  })

  it('reports lost capture for the captured pointer', () => {
    const element = document.createElement('div')
    const onInterrupt = vi.fn()
    captureGesture(element, 1, onInterrupt)

    loseCapture(element)

    expect(onInterrupt).toHaveBeenCalledOnce()
  })

  it('stops reporting lost capture once released', () => {
    const element = document.createElement('div')
    const onInterrupt = vi.fn()
    const release = captureGesture(element, 1, onInterrupt)

    release()
    loseCapture(element)

    expect(onInterrupt).not.toHaveBeenCalled()
  })

  it('ignores lost capture from another pointer', () => {
    const element = document.createElement('div')
    const onInterrupt = vi.fn()
    captureGesture(element, 1, onInterrupt)

    loseCapture(element, 2)

    expect(onInterrupt).not.toHaveBeenCalled()
  })

  it('accepts lost capture events created in another realm', () => {
    const element = document.createElement('div')
    const onInterrupt = vi.fn()
    captureGesture(element, 1, onInterrupt)
    const event = new Event('lostpointercapture')
    Object.defineProperty(event, 'pointerId', { value: 1 })

    element.dispatchEvent(event)

    expect(onInterrupt).toHaveBeenCalledOnce()
  })
})
