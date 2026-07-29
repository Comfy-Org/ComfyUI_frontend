import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { Ref } from 'vue'

import { useAutoPageSize } from './useAutoPageSize'

const resizeObserverState = vi.hoisted(() => {
  const state = {
    callback: null as ResizeObserverCallback | null,
    observe: vi.fn<(element: Element) => void>(),
    disconnect: vi.fn<() => void>()
  }

  const MockResizeObserver: typeof ResizeObserver = class MockResizeObserver implements ResizeObserver {
    observe = state.observe
    unobserve = vi.fn()
    disconnect = state.disconnect

    constructor(callback: ResizeObserverCallback) {
      state.callback = callback
    }
  }

  globalThis.ResizeObserver = MockResizeObserver

  return state
})

interface ContainerShape {
  clientHeight: number
  rowHeight: number | null
  headerHeight: number | null
}

function fakeContainer({
  clientHeight,
  rowHeight,
  headerHeight
}: ContainerShape): HTMLElement {
  return {
    clientHeight,
    querySelector(selector: string) {
      if (selector === 'tbody tr') {
        return rowHeight === null
          ? null
          : { getBoundingClientRect: () => ({ height: rowHeight }) }
      }
      if (selector === 'thead') {
        return headerHeight === null
          ? null
          : { getBoundingClientRect: () => ({ height: headerHeight }) }
      }
      if (selector === 'table') return {}
      return null
    }
  } as unknown as HTMLElement
}

function runInScope(container: Ref<HTMLElement | null>, min?: number) {
  const scope = effectScope()
  const result = scope.run(() => useAutoPageSize(container, min))!
  return { ...result, stop: () => scope.stop() }
}

describe('useAutoPageSize', () => {
  beforeEach(() => {
    resizeObserverState.callback = null
    resizeObserverState.observe.mockClear()
    resizeObserverState.disconnect.mockClear()
  })

  it('fits as many whole rows as the container height allows', () => {
    const container = ref(
      fakeContainer({ clientHeight: 500, rowHeight: 41, headerHeight: 56 })
    )
    const { pageSize } = runInScope(container, 1)

    resizeObserverState.callback!([], {} as ResizeObserver)

    // (500 - 56) / 41 = 10.83 -> floored to 10 whole rows
    expect(pageSize.value).toBe(10)
  })

  it('floors a fractional fit so a not-quite-fitting row is left out', () => {
    const container = ref(
      fakeContainer({ clientHeight: 449, rowHeight: 41, headerHeight: 0 })
    )
    const { pageSize } = runInScope(container, 1)

    resizeObserverState.callback!([], {} as ResizeObserver)

    // 449 / 41 = 10.95 -> 10, never 11 (which would overflow + show a scrollbar)
    expect(pageSize.value).toBe(10)
  })

  it('never returns fewer than the requested minimum', () => {
    const container = ref(
      fakeContainer({ clientHeight: 50, rowHeight: 41, headerHeight: 0 })
    )
    const { pageSize } = runInScope(container, 5)

    resizeObserverState.callback!([], {} as ResizeObserver)

    // fit is 1, but min=5 wins
    expect(pageSize.value).toBe(5)
  })

  it('falls back to a default row height before any rows are rendered', () => {
    const container = ref(
      fakeContainer({ clientHeight: 420, rowHeight: null, headerHeight: 0 })
    )
    const { pageSize } = runInScope(container, 1)

    resizeObserverState.callback!([], {} as ResizeObserver)

    // no tbody row yet -> FALLBACK_ROW_HEIGHT 41: floor(420 / 41) = 10
    expect(pageSize.value).toBe(10)
  })

  it('re-measures when the table height changes after rows load', () => {
    const container = ref(
      fakeContainer({ clientHeight: 420, rowHeight: null, headerHeight: 0 })
    )
    const { pageSize } = runInScope(container, 1)

    resizeObserverState.callback!([], {} as ResizeObserver)
    expect(pageSize.value).toBe(10)

    // real rows arrive taller than the fallback; the observer fires again
    container.value = fakeContainer({
      clientHeight: 420,
      rowHeight: 60,
      headerHeight: 0
    })
    resizeObserverState.callback!([], {} as ResizeObserver)

    // floor(420 / 60) = 7
    expect(pageSize.value).toBe(7)
  })

  it('disconnects the observer when the scope stops', () => {
    const container = ref(
      fakeContainer({ clientHeight: 500, rowHeight: 41, headerHeight: 0 })
    )
    const { stop } = runInScope(container, 1)

    stop()

    expect(resizeObserverState.disconnect).toHaveBeenCalled()
  })
})
