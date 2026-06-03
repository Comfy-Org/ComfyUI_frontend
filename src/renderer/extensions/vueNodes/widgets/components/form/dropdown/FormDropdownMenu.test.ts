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

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
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

  it('keeps pinned items in the flat list when ungrouped', () => {
    const items = [createItem('1', 'Item 1'), createItem('2', 'Item 2')]
    render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        items,
        pinTopNames: ['Item 1']
      },
      global: globalConfig
    })

    const virtualGrid = screen.getByTestId('virtual-grid')
    const virtualItems = JSON.parse(virtualGrid.getAttribute('data-items')!)

    expect(virtualItems.map((i: { name: string }) => i.name)).toEqual([
      'Item 1',
      'Item 2'
    ])
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
    render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    expect(
      screen
        .getByTestId('form-dropdown-menu')
        .getAttribute('data-capture-wheel')
    ).toBe('true')
  })

  /** Regression: PrimeVue Popover teleports the menu to document.body, so
   *  trackpad pinch-zoom and horizontal swipes must be guarded on the menu
   *  itself rather than relying on the LGraphNode wheel handler. */
  it.for([
    { name: 'pinch-zoom', overrides: { ctrlKey: true, deltaY: -10 } },
    { name: 'horizontal swipe', overrides: { deltaX: 30, deltaY: 5 } }
  ])('suppresses browser default for $name', ({ overrides }) => {
    render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    const root = screen.getByTestId('form-dropdown-menu')
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true
    })
    Object.entries(overrides).forEach(([key, value]) => {
      Object.defineProperty(event, key, { value })
    })
    root.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  /** Vertical scrolling must remain native so the dropdown's own scroll
   *  container can scroll its content. */
  it('does not suppress vertical scroll', () => {
    render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    const root = screen.getByTestId('form-dropdown-menu')
    const event = new WheelEvent('wheel', {
      deltaY: 30,
      bubbles: true,
      cancelable: true
    })
    root.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
