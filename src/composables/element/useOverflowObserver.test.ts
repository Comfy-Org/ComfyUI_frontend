import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMutationObserver, useResizeObserver } from '@vueuse/core'

import { useOverflowObserver } from './useOverflowObserver'

vi.mock('@vueuse/core', () => ({
  useMutationObserver: vi.fn(() => ({ stop: vi.fn() })),
  useResizeObserver: vi.fn(() => ({ stop: vi.fn() }))
}))

const useMutationObserverMock = vi.mocked(useMutationObserver)
const useResizeObserverMock = vi.mocked(useResizeObserver)

function setElementWidths(
  element: HTMLElement,
  widths: { scrollWidth: number; clientWidth: number }
) {
  Object.defineProperty(element, 'scrollWidth', {
    value: widths.scrollWidth,
    configurable: true
  })
  Object.defineProperty(element, 'clientWidth', {
    value: widths.clientWidth,
    configurable: true
  })
}

describe('useOverflowObserver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMutationObserverMock.mockReturnValue({ stop: vi.fn() })
    useResizeObserverMock.mockReturnValue({ stop: vi.fn() })
  })

  it('checks overflow immediately when debounce is disabled', () => {
    const element = document.createElement('div')
    const onCheck = vi.fn()
    setElementWidths(element, { scrollWidth: 120, clientWidth: 100 })

    const observer = useOverflowObserver(element, {
      debounceTime: 0,
      onCheck
    })

    observer.checkOverflow()

    expect(observer.isOverflowing.value).toBe(true)
    expect(onCheck).toHaveBeenCalledWith(true)
  })

  it('can skip observers and still dispose', () => {
    const element = document.createElement('div')

    const observer = useOverflowObserver(element, {
      useMutationObserver: false,
      useResizeObserver: false
    })

    observer.dispose()

    expect(observer.disposed.value).toBe(true)
    expect(useMutationObserverMock).not.toHaveBeenCalled()
    expect(useResizeObserverMock).not.toHaveBeenCalled()
  })

  it('stops enabled observers on dispose', () => {
    const element = document.createElement('div')
    const stopMutation = vi.fn()
    const stopResize = vi.fn()
    useMutationObserverMock.mockReturnValue({ stop: stopMutation })
    useResizeObserverMock.mockReturnValue({ stop: stopResize })

    const observer = useOverflowObserver(element)

    observer.dispose()

    expect(stopMutation).toHaveBeenCalledOnce()
    expect(stopResize).toHaveBeenCalledOnce()
  })
})
