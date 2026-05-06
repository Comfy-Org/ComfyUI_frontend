import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'

import FormDropdownMenu from './FormDropdownMenu.vue'
import type { FormDropdownItem, LayoutMode } from './types'

let mockedVisibleEnd: Ref<number>

vi.mock('@tanstack/vue-virtual', async () => {
  const { computed } = await import('vue')
  return {
    useVirtualizer: (options: {
      count: number
      estimateSize: (index: number) => number
    }) =>
      computed(() => {
        const count = options.count
        const end = Math.min(count, mockedVisibleEnd.value)
        const items = Array.from({ length: end }, (_, index) => {
          const size = options.estimateSize(index)
          return {
            index,
            key: index,
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
  mockedVisibleEnd = ref(Infinity)
})

function createItem(id: string, name: string): FormDropdownItem {
  return {
    id,
    preview_url: '',
    name,
    label: name
  }
}

describe('FormDropdownMenu', () => {
  const defaultProps = {
    items: [createItem('1', 'Item 1'), createItem('2', 'Item 2')],
    isSelected: () => false,
    filterOptions: [],
    sortOptions: []
  }

  const globalConfig = {
    stubs: {
      FormDropdownMenuFilter: true,
      FormDropdownMenuActions: true,
      FormDropdownMenuItem: {
        name: 'FormDropdownMenuItem',
        props: ['index', 'name', 'label', 'layout', 'selected', 'previewUrl'],
        template: '<div data-testid="dropdown-item">{{ name }}</div>'
      }
    },
    mocks: {
      $t: (key: string) => key
    }
  }

  it('renders empty state when no items', () => {
    const { container } = render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        items: []
      },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const emptyIcon = container.querySelector('[class*="lucide--circle-off"]')
    expect(emptyIcon).not.toBeNull()
  })

  it('renders dropdown items when items exist', () => {
    render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    const items = screen.getAllByTestId('dropdown-item')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toBe('Item 1')
    expect(items[1].textContent).toBe('Item 2')
  })

  it('uses single column layout for list mode', () => {
    const { container } = render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        layoutMode: 'list' as LayoutMode
      },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const gridRow = container.querySelector(
      '[style*="grid-template-columns"]'
    ) as HTMLElement
    expect(gridRow).not.toBeNull()
    expect(gridRow.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))')
  })

  it('uses 4-column grid layout for grid mode', () => {
    const { container } = render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        layoutMode: 'grid' as LayoutMode
      },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const gridRow = container.querySelector(
      '[style*="grid-template-columns"]'
    ) as HTMLElement
    expect(gridRow).not.toBeNull()
    expect(gridRow.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))')
  })

  it('has data-capture-wheel="true" on the root element', () => {
    const { container } = render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    expect(
      // eslint-disable-next-line testing-library/no-node-access
      container.firstElementChild!.getAttribute('data-capture-wheel')
    ).toBe('true')
  })

  it('renders items without collapsing when count shrinks (FE-535)', async () => {
    // FE-535: Popover keeps menu mounted on close, so scrollY persists across
    // reopens. When `items` shrinks below the previous count, the previous
    // hand-rolled offset math went blank. tanstack reads scrollOffset fresh
    // from the DOM and the browser auto-clamps scrollTop when content shrinks,
    // so the grid never silently collapses to a blank panel.
    const items = Array.from({ length: 6 }, (_, i) =>
      createItem(String(i + 1), `Item ${i + 1}`)
    )
    render(FormDropdownMenu, {
      props: { ...defaultProps, items },
      global: globalConfig
    })
    expect(screen.getAllByTestId('dropdown-item').length).toBe(items.length)
  })
})
