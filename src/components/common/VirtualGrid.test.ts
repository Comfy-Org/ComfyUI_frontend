import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick, ref } from 'vue'

import VirtualGrid from './VirtualGrid.vue'

type TestItem = { key: string; name: string }

let mockedWidth: Ref<number>
let mockedHeight: Ref<number>
let mockedScrollY: Ref<number>

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@vueuse/core')
  return {
    ...actual,
    useElementSize: () => ({ width: mockedWidth, height: mockedHeight }),
    useScroll: () => ({ y: mockedScrollY })
  }
})

beforeEach(() => {
  mockedWidth = ref(400)
  mockedHeight = ref(200)
  mockedScrollY = ref(0)
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
    mockedWidth.value = 400
    mockedHeight.value = 200
    mockedScrollY.value = 0

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
    mockedWidth.value = 400
    mockedHeight.value = 200
    mockedScrollY.value = 0

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
    mockedWidth.value = 400
    mockedHeight.value = 200
    mockedScrollY.value = 0

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

  it('forces cols to maxColumns when maxColumns is finite', async () => {
    mockedWidth.value = 100
    mockedHeight.value = 200
    mockedScrollY.value = 0

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

  it('remeasures items when the grid style changes', async () => {
    const items = createItems(20)
    let itemWidth = 200
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-virtual-grid-item') ? itemWidth : 0
      })
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-virtual-grid-item') ? 100 : 0
      })

    try {
      const { rerender } = render(VirtualGrid, {
        props: {
          items,
          gridStyle: defaultGridStyle,
          defaultItemHeight: 100,
          defaultItemWidth: 200,
          bufferRows: 0
        },
        slots: {
          item: `<template #item="{ item }">
            <div>{{ item.name }}</div>
          </template>`
        }
      })

      await nextTick()
      expect(screen.getAllByText(/^Item \d+$/)).toHaveLength(4)

      itemWidth = 100
      await rerender({
        gridStyle: {
          ...defaultGridStyle,
          gridTemplateColumns: 'repeat(4, 1fr)'
        }
      })
      await nextTick()

      expect(screen.getAllByText(/^Item \d+$/)).toHaveLength(8)
    } finally {
      widthSpy.mockRestore()
      heightSpy.mockRestore()
    }
  })
})
