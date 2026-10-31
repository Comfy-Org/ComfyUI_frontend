import { fireEvent, render, screen } from '@testing-library/vue'
import { useElementSize } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick, ref } from 'vue'

import VirtualGrid from './VirtualGrid.vue'

type TestItem = { key: string; name: string }

let mockedWidth: Ref<number>
let mockedHeight: Ref<number>

vi.mock(import('@vueuse/core'), { spy: true })

beforeEach(() => {
  mockedWidth = ref(400)
  mockedHeight = ref(200)
  vi.mocked(useElementSize).mockImplementation(() => ({
    width: mockedWidth,
    height: mockedHeight,
    stop: vi.fn()
  }))
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

    const { container } = render(VirtualGrid, {
      props: {
        items,
        gridStyle: defaultGridStyle,
        maxColumns: 2
      },
      container: document.body.appendChild(document.createElement('div'))
    })

    await nextTick()

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
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
    key: `asset-${i}`,
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
      attrs: { 'data-testid': 'virtual-grid' },
      slots: {
        item: `<template #item="{ item }">
          <div>{{ item.name }}</div>
        </template>`
      },
      container: document.body.appendChild(document.createElement('div'))
    })
  }

  function renderedNames() {
    return screen.queryAllByText(/^asset-\d+$/).map((el) => el.textContent)
  }

  beforeEach(() => {
    mockedWidth.value = PANEL_WIDTH
    mockedHeight.value = PANEL_HEIGHT
  })

  async function scrollTo(offset: number) {
    await fireEvent.scroll(screen.getByTestId('virtual-grid'), {
      target: { scrollTop: offset }
    })
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

      await scrollTo(offset)
      await nextTick()

      expect(renderedNames()).toContain(expectedItem)
      expect(renderedNames()).not.toContain('asset-0')
    }
  )

  it('goes blank when the filtered list shrinks below the scrolled-to index', async () => {
    const { rerender } = renderLibrary(createLibrary())
    await nextTick()

    await scrollTo(20_000)
    await nextTick()

    const audioOnly = createLibrary().filter((_, i) => isAudio(i))
    await rerender({ items: audioOnly })
    await nextTick()
    await fireEvent.scroll(screen.getByTestId('virtual-grid'))
    await nextTick()

    expect(renderedNames().length).toBeGreaterThan(0)
  })

  it('goes blank when the column count grows while scrolled deep', async () => {
    renderLibrary(createLibrary())
    await nextTick()

    await scrollTo(100_000)
    await nextTick()

    mockedWidth.value = PANEL_WIDTH * 2
    await nextTick()

    expect(renderedNames().length).toBeGreaterThan(0)
  })

  it('recovers when the filtered list shrinks to empty, then grows again', async () => {
    const { rerender } = renderLibrary(createLibrary())
    await nextTick()

    await scrollTo(100_000)
    await nextTick()

    await rerender({ items: [] })
    await nextTick()
    await fireEvent.scroll(screen.getByTestId('virtual-grid'))
    await nextTick()

    expect(renderedNames().length).toBe(0)

    const fullLibrary = createLibrary()
    await rerender({ items: fullLibrary })
    await nextTick()
    await fireEvent.scroll(screen.getByTestId('virtual-grid'))
    await nextTick()

    expect(renderedNames().length).toBeGreaterThan(0)
  })
})

const FULL_PAGE_SCROLL_HEIGHT = 4_000
const VIEWPORT_HEIGHT = 400

function isGridScroller(element: HTMLElement): boolean {
  return element.classList.contains('overflow-y-auto')
}

function visibleEntry(target: Element): IntersectionObserverEntry {
  const bounds = target.getBoundingClientRect()
  return {
    boundingClientRect: bounds,
    intersectionRatio: 1,
    intersectionRect: bounds,
    isIntersecting: true,
    rootBounds: null,
    target,
    time: 0
  }
}

class ImmediateVisibilityObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin = ''
  readonly scrollMargin = ''
  readonly thresholds: readonly number[] = [0]

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback([visibleEntry(target)], this)
  }

  unobserve(): void {}

  disconnect(): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

describe('VirtualGrid loading more when the rendered list shrinks', () => {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem'
  }
  let scrollHeight = FULL_PAGE_SCROLL_HEIGHT

  beforeEach(() => {
    scrollHeight = FULL_PAGE_SCROLL_HEIGHT
    mockedWidth.value = VIEWPORT_HEIGHT
    mockedHeight.value = VIEWPORT_HEIGHT
    vi.stubGlobal('IntersectionObserver', ImmediateVisibilityObserver)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return isGridScroller(this) ? VIEWPORT_HEIGHT : 0
      }
    )
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return isGridScroller(this) ? scrollHeight : 0
      }
    )
  })

  it.for([
    {
      behavior: 'requests the next page when a search leaves the grid empty',
      canLoadMore: true,
      nextCount: 0,
      nextScrollHeight: 0,
      calls: 1
    },
    {
      behavior:
        'requests the next page when one result no longer fills the grid',
      canLoadMore: true,
      nextCount: 1,
      nextScrollHeight: 80,
      calls: 1
    },
    {
      behavior:
        'does not request a page when the grid shrinks and nothing more exists',
      canLoadMore: false,
      nextCount: 0,
      nextScrollHeight: 0,
      calls: 0
    },
    {
      behavior:
        'does not request a page when the filtered grid still fills the viewport',
      canLoadMore: true,
      nextCount: 40,
      nextScrollHeight: FULL_PAGE_SCROLL_HEIGHT,
      calls: 0
    },
    {
      behavior:
        'requests the next page when multiple rows still do not fill the viewport',
      canLoadMore: true,
      nextCount: 6,
      nextScrollHeight: 200,
      calls: 1
    }
  ])(
    '$behavior',
    async ({ canLoadMore, nextCount, nextScrollHeight, calls }) => {
      const onLoadMore = vi.fn()
      const { rerender } = render(VirtualGrid, {
        props: {
          items: createItems(100),
          gridStyle,
          defaultItemHeight: 100,
          defaultItemWidth: 100,
          bufferRows: 0,
          maxColumns: 4,
          canLoadMore,
          onLoadMore
        },
        slots: {
          item: `<template #item="{ item }">
            <div>{{ item.name }}</div>
          </template>`
        },
        container: document.body.appendChild(document.createElement('div'))
      })

      await nextTick()
      await nextTick()
      expect(onLoadMore).not.toHaveBeenCalled()

      scrollHeight = nextScrollHeight
      await rerender({ items: createItems(nextCount) })
      await nextTick()
      await nextTick()

      expect(onLoadMore).toHaveBeenCalledTimes(calls)
    }
  )
})
