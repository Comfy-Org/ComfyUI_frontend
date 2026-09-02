import { render } from '@testing-library/vue'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TextTickerMultiLine from './TextTickerMultiLine.vue'

const hoisted = vi.hoisted(() => ({
  widths: [] as { value: number }[]
}))

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  const { ref } = await import('vue')
  return {
    ...actual,
    useElementSize: () => {
      const width = ref(0)
      hoisted.widths.push(width)
      return { width, height: ref(0) }
    }
  }
})

describe(TextTickerMultiLine, () => {
  let unmountFn: () => void

  afterEach(() => {
    unmountFn?.()
    hoisted.widths.length = 0
  })

  function renderComponent(text: string) {
    const result = render(TextTickerMultiLine, {
      props: { text }
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

  async function setWidths(textWidth: number, containerWidth: number) {
    const [text, container] = hoisted.widths
    text.value = textWidth
    container.value = containerWidth
    await nextTick()
  }

  it('renders a single line when text fits', async () => {
    const { container } = renderComponent('Short')
    await setWidths(100, 200)

    expect(getVisibleLines(container)).toHaveLength(1)
  })

  it('renders two lines when text overflows', async () => {
    const { container } = renderComponent('Load Checkpoint Loader Simple')
    await setWidths(300, 100)

    expect(getVisibleLines(container)).toHaveLength(2)
  })

  it('splits text at word boundary when overflowing', async () => {
    const { container } = renderComponent('Load Checkpoint Loader')
    await setWidths(200, 100)

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
