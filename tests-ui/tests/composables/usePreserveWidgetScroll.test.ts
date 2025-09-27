/**
 * @vitest-environment happy-dom
 */
import { useEventListener } from '@vueuse/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock VueUse
vi.mock('@vueuse/core', () => ({
  useEventListener: vi.fn()
}))

describe('usePreserveWidgetScroll', () => {
  let mockUseEventListener: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockUseEventListener = vi.mocked(useEventListener)
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should set up window wheel event listener with capture and passive options', async () => {
    const { usePreserveWidgetScroll } = await import(
      '@/renderer/extensions/vueNodes/composables/usePreserveWidgetScroll'
    )

    usePreserveWidgetScroll()

    expect(mockUseEventListener).toHaveBeenCalledWith(
      window,
      'wheel',
      expect.any(Function),
      { capture: true, passive: false }
    )
  })

  it('should call stopPropagation on textarea wheel events', async () => {
    let wheelHandler: (event: WheelEvent) => void
    mockUseEventListener.mockImplementation((_target, _event, handler) => {
      wheelHandler = handler
    })

    const { usePreserveWidgetScroll } = await import(
      '@/renderer/extensions/vueNodes/composables/usePreserveWidgetScroll'
    )
    usePreserveWidgetScroll()

    // Create real DOM textarea element and dispatch wheel event
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    const wheelEvent = new WheelEvent('wheel', { bubbles: true })
    const stopPropagation = vi.fn()
    wheelEvent.stopPropagation = stopPropagation

    Object.defineProperty(wheelEvent, 'target', { value: textarea })

    wheelHandler!(wheelEvent)

    expect(stopPropagation).toHaveBeenCalled()
  })

  it('should not call stopPropagation on non-scrollable elements', async () => {
    let wheelHandler: (event: WheelEvent) => void
    mockUseEventListener.mockImplementation((_target, _event, handler) => {
      wheelHandler = handler
    })

    const { usePreserveWidgetScroll } = await import(
      '@/renderer/extensions/vueNodes/composables/usePreserveWidgetScroll'
    )
    usePreserveWidgetScroll()

    // Create regular div element
    const div = document.createElement('div')
    document.body.appendChild(div)

    const wheelEvent = new WheelEvent('wheel', { bubbles: true })
    const stopPropagation = vi.fn()
    wheelEvent.stopPropagation = stopPropagation

    Object.defineProperty(wheelEvent, 'target', { value: div })

    wheelHandler!(wheelEvent)

    expect(stopPropagation).not.toHaveBeenCalled()
  })

  it('should handle PrimeVue select dropdown elements', async () => {
    let wheelHandler: (event: WheelEvent) => void
    mockUseEventListener.mockImplementation((_target, _event, handler) => {
      wheelHandler = handler
    })

    const { usePreserveWidgetScroll } = await import(
      '@/renderer/extensions/vueNodes/composables/usePreserveWidgetScroll'
    )
    usePreserveWidgetScroll()

    // Create element with PrimeVue select option class
    const div = document.createElement('div')
    div.classList.add('p-select-option')
    document.body.appendChild(div)

    const wheelEvent = new WheelEvent('wheel', { bubbles: true })
    const stopPropagation = vi.fn()
    wheelEvent.stopPropagation = stopPropagation

    Object.defineProperty(wheelEvent, 'target', { value: div })

    wheelHandler!(wheelEvent)

    expect(stopPropagation).toHaveBeenCalled()
  })
})
