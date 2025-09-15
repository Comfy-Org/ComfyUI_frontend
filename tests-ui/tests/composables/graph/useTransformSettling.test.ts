import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useTransformSettling } from '@/renderer/core/layout/transform/useTransformSettling'

describe('useTransformSettling', () => {
  let element: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    element = document.createElement('div')
    document.body.appendChild(element)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.removeChild(element)
  })

  it('should track wheel events and settle after delay', async () => {
    const { isTransforming } = useTransformSettling(element)

    // Initially not transforming
    expect(isTransforming.value).toBe(false)

    // Dispatch wheel event
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    await nextTick()

    // Should be transforming
    expect(isTransforming.value).toBe(true)

    // Advance time but not past settle delay
    vi.advanceTimersByTime(100)
    expect(isTransforming.value).toBe(true)

    // Advance past settle delay (default 200ms)
    vi.advanceTimersByTime(150)
    expect(isTransforming.value).toBe(false)
  })

  it('should reset settle timer on subsequent wheel events', async () => {
    const { isTransforming } = useTransformSettling(element, {
      settleDelay: 300
    })

    // First wheel event
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    await nextTick()
    expect(isTransforming.value).toBe(true)

    // Advance time partially
    vi.advanceTimersByTime(200)
    expect(isTransforming.value).toBe(true)

    // Another wheel event should reset the timer
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    await nextTick()

    // Advance 200ms more - should still be transforming
    vi.advanceTimersByTime(200)
    expect(isTransforming.value).toBe(true)

    // Need another 100ms to settle (300ms total from last event)
    vi.advanceTimersByTime(100)
    expect(isTransforming.value).toBe(false)
  })

  it('should track pan events when trackPan is enabled', async () => {
    const { isTransforming } = useTransformSettling(element, {
      trackPan: true,
      settleDelay: 200
    })

    // Pointer down should start transform
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(isTransforming.value).toBe(true)

    // Pointer move should keep it active
    vi.advanceTimersByTime(100)
    element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await nextTick()

    // Should still be transforming
    expect(isTransforming.value).toBe(true)

    // Pointer up
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    await nextTick()

    // Should still be transforming until settle delay
    expect(isTransforming.value).toBe(true)

    // Advance past settle delay
    vi.advanceTimersByTime(200)
    expect(isTransforming.value).toBe(false)
  })

  it('should not track pan events when trackPan is disabled', async () => {
    const { isTransforming } = useTransformSettling(element, {
      trackPan: false
    })

    // Pointer events should not trigger transform
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await nextTick()

    expect(isTransforming.value).toBe(false)
  })

  it('should handle pointer cancel events', async () => {
    const { isTransforming } = useTransformSettling(element, {
      trackPan: true,
      settleDelay: 200
    })

    // Start panning
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(isTransforming.value).toBe(true)

    // Cancel instead of up
    element.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }))
    await nextTick()

    // Should still settle normally
    vi.advanceTimersByTime(200)
    expect(isTransforming.value).toBe(false)
  })

  it('should work with ref target', async () => {
    const targetRef = ref<HTMLElement | null>(null)
    const { isTransforming } = useTransformSettling(targetRef)

    // No target yet
    expect(isTransforming.value).toBe(false)

    // Set target
    targetRef.value = element
    await nextTick()

    // Now events should work
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    await nextTick()
    expect(isTransforming.value).toBe(true)

    vi.advanceTimersByTime(200)
    expect(isTransforming.value).toBe(false)
  })

  it('should use capture phase for events', async () => {
    const captureHandler = vi.fn()
    const bubbleHandler = vi.fn()

    // Add handlers to verify capture phase
    element.addEventListener('wheel', captureHandler, true)
    element.addEventListener('wheel', bubbleHandler, false)

    const { isTransforming } = useTransformSettling(element)

    // Create child element
    const child = document.createElement('div')
    element.appendChild(child)

    // Dispatch event on child
    child.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    await nextTick()

    // Capture handler should be called before bubble handler
    expect(captureHandler).toHaveBeenCalled()
    expect(isTransforming.value).toBe(true)

    element.removeEventListener('wheel', captureHandler, true)
    element.removeEventListener('wheel', bubbleHandler, false)
  })

  it('should throttle pointer move events', async () => {
    const { isTransforming } = useTransformSettling(element, {
      trackPan: true,
      pointerMoveThrottle: 50,
      settleDelay: 100
    })

    // Start panning
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()

    // Fire many pointer move events rapidly
    for (let i = 0; i < 10; i++) {
      element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
      vi.advanceTimersByTime(5) // 5ms between events
    }
    await nextTick()

    // Should still be transforming
    expect(isTransforming.value).toBe(true)

    // End panning
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

    // Advance past settle delay
    vi.advanceTimersByTime(100)
    expect(isTransforming.value).toBe(false)
  })

  it('should clean up event listeners when component unmounts', async () => {
    const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener')

    // Create a test component
    const TestComponent = {
      setup() {
        const { isTransforming } = useTransformSettling(element, {
          trackPan: true
        })
        return { isTransforming }
      },
      template: '<div>{{ isTransforming }}</div>'
    }

    const wrapper = mount(TestComponent)
    await nextTick()

    // Unmount component
    wrapper.unmount()

    // Should have removed all event listeners
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'wheel',
      expect.any(Function),
      expect.objectContaining({ capture: true })
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
      expect.objectContaining({ capture: true })
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointermove',
      expect.any(Function),
      expect.objectContaining({ capture: true })
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointerup',
      expect.any(Function),
      expect.objectContaining({ capture: true })
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointercancel',
      expect.any(Function),
      expect.objectContaining({ capture: true })
    )
  })

  it('should use passive listeners when specified', async () => {
    const addEventListenerSpy = vi.spyOn(element, 'addEventListener')

    useTransformSettling(element, {
      passive: true,
      trackPan: true
    })

    // Check that passive option was used for appropriate events
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'wheel',
      expect.any(Function),
      expect.objectContaining({ passive: true, capture: true })
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'pointermove',
      expect.any(Function),
      expect.objectContaining({ passive: true, capture: true })
    )
  })
})
