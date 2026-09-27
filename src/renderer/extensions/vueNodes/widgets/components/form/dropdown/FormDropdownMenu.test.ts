import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FormDropdownMenu from './FormDropdownMenu.vue'
import type { FormDropdownItem, LayoutMode } from './types'

const VirtualGridStub = {
  name: 'VirtualGrid',
  props: ['items', 'maxColumns', 'itemHeight', 'scrollerHeight'],
  emits: ['approach-end'],
  template:
    '<div data-testid="virtual-grid" :data-items="JSON.stringify(items)" :data-max-columns="maxColumns" @click="$emit(\'approach-end\')" />'
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
    uploadable: false,
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

  it('forwards approach-end from the virtual grid', async () => {
    const user = userEvent.setup()
    const { emitted } = render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    await user.click(screen.getByTestId('virtual-grid'))

    expect(emitted()['approach-end']).toHaveLength(1)
  })

  it('shows the loading-more row only while loadingMore is set', async () => {
    const { rerender } = render(FormDropdownMenu, {
      props: { ...defaultProps, loadingMore: true },
      global: globalConfig
    })

    expect(screen.getByTestId('form-dropdown-loading-more')).toBeTruthy()

    await rerender({ ...defaultProps, loadingMore: false })

    expect(screen.queryByTestId('form-dropdown-loading-more')).toBeNull()
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
   *  trackpad pinch-zoom must be guarded on the menu itself — `LGraphNode`
   *  never sees these events. macOS pinch synthesizes `ctrlKey`; explicit
   *  `⌘ + wheel` (and Windows/Linux equivalents) come through as `metaKey`. */
  it.for([
    { name: 'ctrlKey', modifier: 'ctrlKey' as const },
    { name: 'metaKey', modifier: 'metaKey' as const }
  ])('suppresses browser default for pinch-zoom ($name)', ({ modifier }) => {
    render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    const root = screen.getByTestId('form-dropdown-menu')
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true })
    Object.defineProperty(event, modifier, { value: true })
    Object.defineProperty(event, 'deltaY', { value: -10 })
    root.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  /** Stub that surfaces `uploadable` as a data attribute and exposes a button
   *  that emits `show-picker`, so the parent's prop-forwarding and event
   *  re-emission can be asserted from the DOM. */
  const FormDropdownMenuFilterStub = {
    name: 'FormDropdownMenuFilter',
    props: ['uploadable', 'filterOptions'],
    emits: ['show-picker'],
    template:
      '<button data-testid="filter-stub" :data-uploadable="String(uploadable)" @click="$emit(\'show-picker\')" />'
  }

  it('forwards uploadable prop to FormDropdownMenuFilter', () => {
    render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        uploadable: true,
        filterOptions: [{ name: 'All', value: 'all' }]
      },
      global: {
        stubs: {
          FormDropdownMenuFilter: FormDropdownMenuFilterStub,
          FormDropdownMenuActions: true,
          VirtualGrid: VirtualGridStub
        },
        mocks: { $t: (key: string) => key }
      }
    })

    expect(screen.getByTestId('filter-stub').dataset.uploadable).toBe('true')
  })

  it('re-emits show-picker when FormDropdownMenuFilter emits it', async () => {
    const { emitted } = render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        uploadable: true,
        filterOptions: [{ name: 'All', value: 'all' }]
      },
      global: {
        stubs: {
          FormDropdownMenuFilter: FormDropdownMenuFilterStub,
          FormDropdownMenuActions: true,
          VirtualGrid: VirtualGridStub
        },
        mocks: { $t: (key: string) => key }
      }
    })

    await userEvent.click(screen.getByTestId('filter-stub'))
    expect(emitted('show-picker')).toHaveLength(1)
  })

  /** Regression: slow trackpad vertical scrolls emit small-delta frames with
   *  stray horizontal jitter (`|deltaX| > |deltaY|`). preventDefault-ing those
   *  cancelled the native scroll and starved the VirtualGrid's `useScroll`,
   *  leaving rows blank. Horizontal-swipe-to-navigate is blocked at the page
   *  boundary by `overscroll-behavior: none` on `html, body`, so the local
   *  handler must NOT preventDefault these events. The `pure vertical` case
   *  also covers plain native scrolling of the dropdown's own content. */
  it.for([
    { name: 'pure vertical', overrides: { deltaY: 30 } },
    {
      name: 'slow scroll with horizontal jitter',
      overrides: { deltaX: 1.5, deltaY: 1.2 }
    },
    {
      name: 'pronounced horizontal swipe',
      overrides: { deltaX: 30, deltaY: 5 }
    }
  ])('does not suppress $name wheel', ({ overrides }) => {
    render(FormDropdownMenu, {
      props: defaultProps,
      global: globalConfig
    })

    const root = screen.getByTestId('form-dropdown-menu')
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true })
    Object.entries(overrides).forEach(([key, value]) => {
      Object.defineProperty(event, key, { value })
    })
    root.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
