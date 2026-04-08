/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FormDropdownMenu from './FormDropdownMenu.vue'
import type { FormDropdownItem, LayoutMode } from './types'

const VirtualGridStub = {
  name: 'VirtualGrid',
  props: ['items', 'maxColumns', 'itemHeight', 'scrollerHeight'],
  template:
    '<div data-testid="virtual-grid" :data-items="JSON.stringify(items)" :data-max-columns="maxColumns" />'
}

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
      VirtualGrid: VirtualGridStub
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

    const emptyIcon = container.querySelector('[class*="lucide--circle-off"]')
    expect(emptyIcon).not.toBeNull()
  })

  it('renders VirtualGrid when items exist', () => {
    render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    expect(screen.getByTestId('virtual-grid')).toBeTruthy()
  })

  it('transforms items to include key property for VirtualGrid', () => {
    const items = [createItem('1', 'Item 1'), createItem('2', 'Item 2')]
    render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        items
      },
      global: globalConfig
    })

    const virtualGrid = screen.getByTestId('virtual-grid')
    const virtualItems = JSON.parse(virtualGrid.getAttribute('data-items')!)

    expect(virtualItems).toHaveLength(2)
    expect(virtualItems[0]).toHaveProperty('key', '1')
    expect(virtualItems[1]).toHaveProperty('key', '2')
  })

  it('uses single column layout for list modes', () => {
    render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        layoutMode: 'list' as LayoutMode
      },
      global: globalConfig
    })

    const virtualGrid = screen.getByTestId('virtual-grid')
    expect(virtualGrid.getAttribute('data-max-columns')).toBe('1')
  })

  it('has data-capture-wheel="true" on the root element', () => {
    const { container } = render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    expect(
      container.firstElementChild!.getAttribute('data-capture-wheel')
    ).toBe('true')
  })
})
