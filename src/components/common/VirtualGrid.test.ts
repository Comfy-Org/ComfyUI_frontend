import { mount } from '@vue/test-utils'
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

    const wrapper = mount(VirtualGrid<TestItem>, {
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
      attachTo: document.body
    })

    await nextTick()

    const renderedItems = wrapper.findAll('.test-item')
    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length).toBeLessThan(items.length)

    wrapper.unmount()
  })

  it('provides correct index in slot props', async () => {
    const items = createItems(20)
    const receivedIndices: number[] = []
    mockedWidth.value = 400
    mockedHeight.value = 200
    mockedScrollY.value = 0

    const wrapper = mount(VirtualGrid<TestItem>, {
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
      attachTo: document.body
    })

    await nextTick()

    expect(receivedIndices.length).toBeGreaterThan(0)
    expect(receivedIndices[0]).toBe(0)
    for (let i = 1; i < receivedIndices.length; i++) {
      expect(receivedIndices[i]).toBe(receivedIndices[i - 1] + 1)
    }

    wrapper.unmount()
  })

  it('respects maxColumns prop', async () => {
    const items = createItems(10)
    mockedWidth.value = 400
    mockedHeight.value = 200
    mockedScrollY.value = 0

    const wrapper = mount(VirtualGrid<TestItem>, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        maxColumns: 2
      },
      attachTo: document.body
    })

    await nextTick()

    const gridElement = wrapper.find('[style*="display: grid"]')
    expect(gridElement.exists()).toBe(true)

    const gridEl = gridElement.element as HTMLElement
    expect(gridEl.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')

    wrapper.unmount()
  })

  it('renders empty when no items provided', async () => {
    const wrapper = mount(VirtualGrid<TestItem>, {
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

    const renderedItems = wrapper.findAll('.test-item')
    expect(renderedItems.length).toBe(0)

    wrapper.unmount()
  })

  it('emits approach-end for single-column list when scrolled near bottom', async () => {
    const items = createItems(50)
    mockedWidth.value = 400
    mockedHeight.value = 600
    mockedScrollY.value = 0

    const wrapper = mount(VirtualGrid<TestItem>, {
      props: {
        items,
        gridStyle: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)'
        },
        defaultItemHeight: 48,
        defaultItemWidth: 200,
        maxColumns: 1,
        bufferRows: 1
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      attachTo: document.body
    })

    await nextTick()

    expect(wrapper.emitted('approach-end')).toBeUndefined()

    // Scroll near the end: 50 items * 48px = 2400px total
    // viewRows = ceil(600/48) = 13, buffer = 1
    // Need toCol >= items.length - cols*bufferRows = 50 - 1 = 49
    // toCol = (offsetRows + bufferRows + viewRows) * cols
    // offsetRows = floor(scrollY / 48)
    // Need (offsetRows + 1 + 13) * 1 >= 49 → offsetRows >= 35
    // scrollY = 35 * 48 = 1680
    mockedScrollY.value = 1680
    await nextTick()

    expect(wrapper.emitted('approach-end')).toBeDefined()

    wrapper.unmount()
  })

  it('does not emit approach-end without maxColumns in single-column layout', async () => {
    // Demonstrates the bug: without maxColumns=1, cols is calculated
    // from width/itemWidth (400/200 = 2), causing incorrect row math
    const items = createItems(50)
    mockedWidth.value = 400
    mockedHeight.value = 600
    mockedScrollY.value = 0

    const wrapper = mount(VirtualGrid<TestItem>, {
      props: {
        items,
        gridStyle: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)'
        },
        defaultItemHeight: 48,
        defaultItemWidth: 200,
        // No maxColumns — cols will be floor(400/200) = 2
        bufferRows: 1
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      attachTo: document.body
    })

    await nextTick()

    // Same scroll position as the passing test
    mockedScrollY.value = 1680
    await nextTick()

    // With cols=2, toCol = (35+1+13)*2 = 98, which exceeds items.length (50)
    // remainingCol = 50-98 = -48, hasMoreToRender = false → isNearEnd = false
    // The approach-end never fires at the correct scroll position
    expect(wrapper.emitted('approach-end')).toBeUndefined()

    wrapper.unmount()
  })

  it('renders a single item correctly', async () => {
    const items = createItems(1)
    mockedWidth.value = 400
    mockedHeight.value = 200
    mockedScrollY.value = 0

    const wrapper = mount(VirtualGrid<TestItem>, {
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
      attachTo: document.body
    })

    await nextTick()

    const renderedItems = wrapper.findAll('.test-item')
    expect(renderedItems).toHaveLength(1)
    expect(renderedItems[0].text()).toBe('Item 0')

    wrapper.unmount()
  })

  it('renders all items when they exactly fill the viewport', async () => {
    // 2 rows × 4 cols = 8 items, viewport = 200px, itemHeight = 100px → 2 rows
    const items = createItems(8)
    mockedWidth.value = 400
    mockedHeight.value = 200
    mockedScrollY.value = 0

    const wrapper = mount(VirtualGrid<TestItem>, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        defaultItemHeight: 100,
        defaultItemWidth: 100,
        maxColumns: 4,
        bufferRows: 0
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      attachTo: document.body
    })

    await nextTick()

    const renderedItems = wrapper.findAll('.test-item')
    expect(renderedItems).toHaveLength(8)

    wrapper.unmount()
  })

  it('renders only visible items when items overflow the viewport', async () => {
    // 4 cols, itemHeight=100, viewport=200 → 2 visible rows = 8 visible items
    // With bufferRows=0, only those 8 should render out of 100 total
    const items = createItems(100)
    mockedWidth.value = 400
    mockedHeight.value = 200
    mockedScrollY.value = 0

    const wrapper = mount(VirtualGrid<TestItem>, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        defaultItemHeight: 100,
        defaultItemWidth: 100,
        maxColumns: 4,
        bufferRows: 0
      },
      slots: {
        item: `<template #item="{ item }">
          <div class="test-item">{{ item.name }}</div>
        </template>`
      },
      attachTo: document.body
    })

    await nextTick()

    const renderedItems = wrapper.findAll('.test-item')
    // viewRows = ceil(200/100) = 2, cols = 4 → 8 items
    expect(renderedItems).toHaveLength(8)
    expect(renderedItems[0].text()).toBe('Item 0')
    expect(renderedItems[7].text()).toBe('Item 7')

    wrapper.unmount()
  })

  it('forces cols to maxColumns when maxColumns is finite', async () => {
    mockedWidth.value = 100
    mockedHeight.value = 200
    mockedScrollY.value = 0

    const items = createItems(20)
    const wrapper = mount(VirtualGrid<TestItem>, {
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
      attachTo: document.body
    })

    await nextTick()

    const renderedItems = wrapper.findAll('.test-item')
    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length % 4).toBe(0)

    wrapper.unmount()
  })
})
