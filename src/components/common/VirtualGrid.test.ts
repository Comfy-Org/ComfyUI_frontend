import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { useElementSize, useEventListener, useScroll } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick, ref, toValue, watchEffect } from 'vue'

import VirtualGrid from './VirtualGrid.vue'

type TestItem = { id: string; name: string }

let mockedWidth: Ref<number>
let mockedHeight: Ref<number>
let mockedScrollY: Ref<number>

vi.mock(import('@vueuse/core'), { spy: true })

beforeEach(() => {
  mockedWidth = ref(400)
  mockedHeight = ref(200)
  mockedScrollY = ref(0)
  vi.mocked(useElementSize).mockImplementation(() =>
    fromPartial({
      width: mockedWidth,
      height: mockedHeight
    })
  )
  vi.mocked(useScroll).mockImplementation(() =>
    fromPartial({ y: mockedScrollY })
  )
})

function createItems(count: number): TestItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
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

const TILE_HEIGHT = 190
const TILE_WIDTH = 129
const PANEL_WIDTH = 414
const PANEL_HEIGHT = 700
const LIBRARY_SIZE = 2000

function isAudio(index: number): boolean {
  return index % 100 === 0
}

function createLibrary(): TestItem[] {
  return Array.from({ length: LIBRARY_SIZE }, (_, i) => ({
    id: `asset-${i}`,
    name: `asset-${i}`
  }))
}

describe('VirtualGrid scrolled deep into a large library', () => {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '0.5rem'
  }

  function renderLibrary(items: TestItem[]) {
    return render(VirtualGrid, {
      props: {
        items,
        gridStyle,
        defaultItemHeight: TILE_HEIGHT,
        defaultItemWidth: TILE_WIDTH,
        bufferRows: 1
      },
      slots: {
        item: `<template #item="{ item }">
          <div>{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })
  }

  let scrollContainer: HTMLElement | null = null

  function renderedNames() {
    return screen.queryAllByText(/^asset-\d+$/).map((el) => el.textContent)
  }

  beforeEach(() => {
    mockedWidth.value = PANEL_WIDTH
    mockedHeight.value = PANEL_HEIGHT
    mockedScrollY.value = 0
    scrollContainer = null
    vi.mocked(useScroll).mockImplementation((target) => {
      const y = ref(0)
      watchEffect((onCleanup) => {
        const element = toValue(target)
        if (!(element instanceof HTMLElement)) return
        scrollContainer = element

        function sync() {
          const current = toValue(target)
          if (current instanceof HTMLElement) y.value = current.scrollTop
        }

        sync()
        onCleanup(useEventListener(element, 'scroll', sync))
      })
      return fromPartial({ y })
    })
  })

  function syncScrollPosition() {
    if (!scrollContainer) throw new Error('no scroll container rendered')
    scrollContainer.dispatchEvent(new Event('scroll'))
  }

  function scrollTo(offset: number) {
    if (!scrollContainer) throw new Error('no scroll container rendered')
    scrollContainer.scrollTop = offset
    syncScrollPosition()
  }

  it.for([
    { offset: 20_000, expectedItem: 'asset-312' },
    { offset: 100_000, expectedItem: 'asset-1575' }
  ])(
    'windows onto $expectedItem at offset $offset',
    async ({ offset, expectedItem }) => {
      renderLibrary(createLibrary())
      await nextTick()

      expect(renderedNames().length).toBeLessThan(LIBRARY_SIZE)

      scrollTo(offset)
      await nextTick()

      expect(renderedNames()).toContain(expectedItem)
      expect(renderedNames()).not.toContain('asset-0')
    }
  )

  it('does not blank when the filtered list shrinks below the scrolled-to index', async () => {
    const { rerender } = renderLibrary(createLibrary())
    await nextTick()

    scrollTo(20_000)
    await nextTick()

    const audioOnly = createLibrary().filter((_, i) => isAudio(i))
    await rerender({ items: audioOnly })
    await nextTick()
    syncScrollPosition()
    await nextTick()

    expect(renderedNames().length).toBeGreaterThan(0)
  })

  it('does not blank when the column count grows while scrolled deep', async () => {
    renderLibrary(createLibrary())
    await nextTick()

    scrollTo(100_000)
    await nextTick()

    mockedWidth.value = PANEL_WIDTH * 2
    await nextTick()

    expect(renderedNames().length).toBeGreaterThan(0)
  })
})
