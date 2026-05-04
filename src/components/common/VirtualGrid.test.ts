import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick, ref } from 'vue'

import VirtualGrid from './VirtualGrid.vue'

type TestItem = { key: string; name: string }

let mockedWidth: Ref<number>
let mockedHeight: Ref<number>
let mockedVisibleEnd: Ref<number>

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@vueuse/core')
  return {
    ...actual,
    useElementSize: () => ({ width: mockedWidth, height: mockedHeight })
  }
})

vi.mock('@tanstack/vue-virtual', async () => {
  const { computed } = await import('vue')
  return {
    useVirtualizer: (options: {
      count: number
      estimateSize: (index: number) => number
      getItemKey?: (index: number) => number | string
    }) =>
      computed(() => {
        const count = options.count
        const end = Math.min(count, mockedVisibleEnd.value)
        const items = Array.from({ length: end }, (_, index) => {
          const size = options.estimateSize(index)
          return {
            index,
            key: options.getItemKey?.(index) ?? index,
            start: index * size,
            size
          }
        })
        const totalSize = count * (count > 0 ? options.estimateSize(0) : 0)
        return {
          getVirtualItems: () => items,
          getTotalSize: () => totalSize
        }
      })
  }
})

beforeEach(() => {
  mockedWidth = ref(400)
  mockedHeight = ref(200)
  mockedVisibleEnd = ref(Infinity)
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

  it('renders items provided by the virtualizer', async () => {
    const items = createItems(100)
    // Visible window: 3 rows out of 25 (4 cols × 25 rows)
    mockedVisibleEnd.value = 3

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

  it('provides sequential indices in slot props', async () => {
    const items = createItems(20)
    const receivedIndices: number[] = []

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

  it('emits approach-end when last rendered row is within bufferRows of the end', async () => {
    const items = createItems(50)
    // Single column → 50 rows; show first 14 rows (not near end)
    mockedVisibleEnd.value = 14

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

    // Reveal up to the last row → triggers approach-end
    mockedVisibleEnd.value = 50
    await nextTick()

    expect(onApproachEnd).toHaveBeenCalled()
  })

  it('renders the last item when the entire range is visible (FE-535 invariant)', async () => {
    // FE-535 motivating invariant: given items > 0, the user must be able to
    // see them — the grid never silently collapses to a blank panel even when
    // viewport state edges (over-scroll, retained scroll across reopens, items
    // shrink while popover is mounted) would have desynced the previous
    // hand-rolled offset math. Guarded structurally by @tanstack/vue-virtual.
    const items = createItems(8)
    mockedVisibleEnd.value = Infinity

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

    const rendered = screen.queryAllByText(/^Item \d+$/)
    expect(rendered.length).toBe(items.length)
    expect(rendered.some((el) => el.textContent === 'Item 7')).toBe(true)
  })

  it('forces cols to maxColumns when maxColumns is finite', async () => {
    mockedWidth.value = 100
    mockedHeight.value = 200

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
