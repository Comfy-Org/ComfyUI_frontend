import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TextTickerMultiLine from './TextTickerMultiLine.vue'

type Callback = () => void

const resizeCallbacks: Callback[] = []
const mutationCallbacks: Callback[] = []

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...actual,
    useResizeObserver: (_target: unknown, cb: Callback) => {
      resizeCallbacks.push(cb)
      return { stop: vi.fn() }
    },
    useMutationObserver: (_target: unknown, cb: Callback) => {
      mutationCallbacks.push(cb)
      return { stop: vi.fn() }
    }
  }
})

function mockElementSize(
  el: HTMLElement,
  clientWidth: number,
  scrollWidth: number
) {
  Object.defineProperty(el, 'clientWidth', {
    value: clientWidth,
    configurable: true
  })
  Object.defineProperty(el, 'scrollWidth', {
    value: scrollWidth,
    configurable: true
  })
}

describe(TextTickerMultiLine, () => {
  let unmountFn: () => void

  afterEach(() => {
    unmountFn?.()
    resizeCallbacks.length = 0
    mutationCallbacks.length = 0
  })

  function renderComponent(text: string) {
    const result = render(TextTickerMultiLine, {
      slots: { default: text }
    })
    unmountFn = result.unmount
    return {
      ...result,
      container: result.container as HTMLElement
    }
  }

  function getMeasureEl(container: HTMLElement): HTMLElement {
    // eslint-disable-next-line testing-library/no-node-access
    return container.querySelector('[aria-hidden="true"]') as HTMLElement
  }

  function getVisibleLines(container: HTMLElement): HTMLElement[] {
    /* eslint-disable testing-library/no-node-access */
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'div.overflow-hidden:not([aria-hidden])'
      )
    )
    /* eslint-enable testing-library/no-node-access */
  }

  async function triggerSplitLines() {
    resizeCallbacks.forEach((cb) => cb())
    await nextTick()
  }

  it('renders slot content', () => {
    renderComponent('Load Checkpoint')
    expect(
      screen.getAllByText('Load Checkpoint').length
    ).toBeGreaterThanOrEqual(1)
  })

  it('renders a single line when text fits', async () => {
    const { container } = renderComponent('Short')
    mockElementSize(getMeasureEl(container), 200, 100)
    await triggerSplitLines()

    expect(getVisibleLines(container)).toHaveLength(1)
  })

  it('renders two lines when text overflows', async () => {
    const { container } = renderComponent('Load Checkpoint Loader Simple')
    mockElementSize(getMeasureEl(container), 100, 300)
    await triggerSplitLines()

    expect(getVisibleLines(container)).toHaveLength(2)
  })

  it('splits text at word boundary when overflowing', async () => {
    const { container } = renderComponent('Load Checkpoint Loader')
    mockElementSize(getMeasureEl(container), 100, 200)
    await triggerSplitLines()

    const lines = getVisibleLines(container)
    expect(lines[0].textContent).toBe('Load')
    expect(lines[1].textContent).toBe('Checkpoint Loader')
  })

  it('has hidden measurement element with aria-hidden', () => {
    const { container } = renderComponent('Test')
    const measureEl = getMeasureEl(container)
    expect(measureEl).toBeInTheDocument()
    expect(measureEl).toHaveClass('invisible')
  })
})
