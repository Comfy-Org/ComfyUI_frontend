import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { computed, nextTick, ref } from 'vue'

import VirtualGrid from './VirtualGrid.vue'

type TestItem = { key: string; name: string }

let mockedWidth: Ref<number>
let mockedHeight: Ref<number>
let mockedFirstRow: Ref<number>
let mockedLastRow: Ref<number>

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@vueuse/core')
  return {
    ...actual,
    useElementSize: () => ({ width: mockedWidth, height: mockedHeight })
  }
})

vi.mock('@tanstack/vue-virtual', () => ({
  useVirtualizer: (options: {
    count: number
    estimateSize: (index: number) => number
  }) =>
    computed(() => {
      const count = options.count
      const size = count > 0 ? options.estimateSize(0) : 0
      const first = Math.max(0, Math.min(count - 1, mockedFirstRow.value))
      const last = Math.max(first, Math.min(count - 1, mockedLastRow.value))
      const items =
        count === 0
          ? []
          : Array.from({ length: last - first + 1 }, (_, i) => {
              const index = first + i
              return {
                index,
                key: index,
                start: index * size,
                end: (index + 1) * size,
                size
              }
            })
      return {
        getVirtualItems: () => items,
        getTotalSize: () => count * size,
        measure: () => {}
      }
    })
}))

beforeEach(() => {
  mockedWidth = ref(400)
  mockedHeight = ref(200)
  mockedFirstRow = ref(0)
  mockedLastRow = ref(0)
})

function createItems(count: number): TestItem[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `item-${i}`,
    name: `Item ${i}`
  }))
}

describe('VirtualGrid', () => {
  const defaultGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem'
  }

  it('renders items within the visible range', async () => {
    const items = createItems(100)
    mockedFirstRow.value = 0
    mockedLastRow.value = 2

    render(VirtualGrid, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        defaultItemHeight: 100,
        defaultItemWidth: 100,
        maxColumns: 4,
        bufferRows: 1
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()

    const renderedItems = screen.getAllByText(/^Item \d+$/)
    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length).toBeLessThan(items.length)
  })

  it('provides correct index in slot props', async () => {
    const items = createItems(20)
    const receivedIndices: number[] = []
    mockedFirstRow.value = 0
    mockedLastRow.value = 4

    render(VirtualGrid, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        defaultItemHeight: 50,
        defaultItemWidth: 100,
        maxColumns: 1,
        bufferRows: 0
      },
      slots: {
        item: ({ index }: { index: number }) => {
          receivedIndices.push(index)
          return null
        }
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()

    expect(receivedIndices.length).toBeGreaterThan(0)
    expect(receivedIndices[0]).toBe(0)
    for (let i = 1; i < receivedIndices.length; i++) {
      expect(receivedIndices[i]).toBe(receivedIndices[i - 1] + 1)
    }
  })

  it('respects maxColumns prop', async () => {
    const items = createItems(10)
    mockedFirstRow.value = 0
    mockedLastRow.value = 1

    const { container } = render(VirtualGrid, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        maxColumns: 2
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const gridElement = container.querySelector(
      '[style*="display: grid"]'
    ) as HTMLElement
    expect(gridElement).not.toBeNull()
    expect(gridElement.style.gridTemplateColumns).toBe(
      'repeat(2, minmax(0, 1fr))'
    )
  })

  it('renders empty when no items provided', async () => {
    render(VirtualGrid, {
      props: {
        items: [],
        gridStyle: defaultGridStyle
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      }
    })

    await nextTick()

    const renderedItems = screen.queryAllByText(/^Item \d+$/)
    expect(renderedItems.length).toBe(0)
  })

  it('emits approach-end when last visible row reaches within bufferRows of end', async () => {
    const items = createItems(50)
    mockedWidth.value = 400
    mockedHeight.value = 600
    // start far from end so whenever() can observe the false→true transition
    mockedFirstRow.value = 0
    mockedLastRow.value = 5

    const onApproachEnd = vi.fn()

    render(VirtualGrid, {
      props: {
        items,
        gridStyle: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)'
        },
        defaultItemHeight: 48,
        defaultItemWidth: 200,
        maxColumns: 1,
        bufferRows: 1,
        onApproachEnd
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()
    expect(onApproachEnd).not.toHaveBeenCalled()

    // 50 rows total, bufferRows=1 → fires when lastRow >= 48
    mockedFirstRow.value = 35
    mockedLastRow.value = 48
    await nextTick()

    expect(onApproachEnd).toHaveBeenCalled()
  })

  it('does not emit approach-end while window is far from end', async () => {
    const items = createItems(50)
    mockedFirstRow.value = 0
    mockedLastRow.value = 5

    const onApproachEnd = vi.fn()

    render(VirtualGrid, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        defaultItemHeight: 48,
        defaultItemWidth: 200,
        maxColumns: 1,
        bufferRows: 1,
        onApproachEnd
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()

    expect(onApproachEnd).not.toHaveBeenCalled()
  })

  it('derives cols from container width when maxColumns is not set', async () => {
    // width=400, defaultItemWidth=200 → cols = floor(400/200) = 2
    mockedWidth.value = 400
    mockedFirstRow.value = 0
    mockedLastRow.value = 2

    const items = createItems(20)
    render(VirtualGrid, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        defaultItemHeight: 100,
        defaultItemWidth: 200,
        bufferRows: 0
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()

    // 3 rows rendered (firstRow=0..lastRow=2) * 2 cols = 6 items
    const rendered = screen.getAllByText(/^Item \d+$/)
    expect(rendered.length).toBe(6)
  })

  it('emits approach-end only once per false→true transition', async () => {
    const items = createItems(50)
    mockedFirstRow.value = 0
    mockedLastRow.value = 5

    const onApproachEnd = vi.fn()

    render(VirtualGrid, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        defaultItemHeight: 48,
        defaultItemWidth: 200,
        maxColumns: 1,
        bufferRows: 1,
        onApproachEnd
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()
    expect(onApproachEnd).toHaveBeenCalledTimes(0)

    // false → true transition: should fire exactly once
    mockedFirstRow.value = 35
    mockedLastRow.value = 48
    await nextTick()
    expect(onApproachEnd).toHaveBeenCalledTimes(1)

    // still near-end (recompute but no transition): must not re-fire
    mockedFirstRow.value = 36
    mockedLastRow.value = 49
    await nextTick()
    expect(onApproachEnd).toHaveBeenCalledTimes(1)
  })

  it('renders correctly after items shrink below previous render window (FE-535)', async () => {
    // Simulate "scrolled deep, then items shrink" scenario
    mockedFirstRow.value = 28
    mockedLastRow.value = 32

    const { rerender } = render(VirtualGrid, {
      props: {
        items: createItems(100),
        gridStyle: defaultGridStyle,
        defaultItemHeight: 50,
        defaultItemWidth: 100,
        maxColumns: 1
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()
    expect(screen.queryAllByText(/^Item \d+$/).length).toBeGreaterThan(0)

    // Items shrink. Browser auto-clamps scrollTop, virtualizer reports
    // valid rows for the new (smaller) count.
    mockedFirstRow.value = 0
    mockedLastRow.value = 4
    await rerender({
      items: createItems(5),
      gridStyle: defaultGridStyle,
      defaultItemHeight: 50,
      defaultItemWidth: 100,
      maxColumns: 1
    })
    await nextTick()

    expect(screen.queryAllByText(/^Item \d+$/).length).toBe(5)
  })

  it('forces cols to maxColumns when maxColumns is finite', async () => {
    mockedWidth.value = 100
    mockedHeight.value = 200
    mockedFirstRow.value = 0
    mockedLastRow.value = 2

    const items = createItems(20)
    render(VirtualGrid, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        defaultItemHeight: 50,
        defaultItemWidth: 200,
        maxColumns: 4,
        bufferRows: 0
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()

    const renderedItems = screen.getAllByText(/^Item \d+$/)
    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length % 4).toBe(0)
  })
})
