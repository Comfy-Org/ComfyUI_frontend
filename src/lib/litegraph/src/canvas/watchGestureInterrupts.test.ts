import { describe, expect, it, vi } from 'vitest'

import { watchGestureInterrupts } from './watchGestureInterrupts'

describe('watchGestureInterrupts', () => {
  it('removes every interruption listener when stopped', () => {
    const element = document.createElement('div')
    const onInterrupt = vi.fn()
    const stop = watchGestureInterrupts(element, 1, onInterrupt)

    stop()
    element.dispatchEvent(
      new PointerEvent('lostpointercapture', { pointerId: 1 })
    )
    window.dispatchEvent(new Event('blur'))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onInterrupt).not.toHaveBeenCalled()
  })

  it('ignores lost capture from another pointer', () => {
    const element = document.createElement('div')
    const onInterrupt = vi.fn()
    watchGestureInterrupts(element, 1, onInterrupt)

    element.dispatchEvent(
      new PointerEvent('lostpointercapture', { pointerId: 2 })
    )

    expect(onInterrupt).not.toHaveBeenCalled()
  })

  it('accepts lost capture events created in another realm', () => {
    const element = document.createElement('div')
    const onInterrupt = vi.fn()
    watchGestureInterrupts(element, 1, onInterrupt)
    const event = new Event('lostpointercapture')
    Object.defineProperty(event, 'pointerId', { value: 1 })

    element.dispatchEvent(event)

    expect(onInterrupt).toHaveBeenCalledOnce()
  })
})
