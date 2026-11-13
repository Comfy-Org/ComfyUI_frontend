import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { useElementSize } from '@vueuse/core'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockPagedList } from '@/utils/__tests__/pagedListUtils'
import FormDropdownMenu from './FormDropdownMenu.vue'
import type { FormDropdownItem, LayoutMode } from './types'

vi.mock(import('@vueuse/core'), { spy: true })

beforeEach(() => {
  vi.mocked(useElementSize).mockReturnValue({
    width: ref(400),
    height: ref(200),
    stop: vi.fn()
  })
})

function createItem(id: string, name: string): FormDropdownItem {
  return {
    id,
    thumbnail: { icon: '', isVideo: false },
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
    plugins: [
      createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
    ],
    stubs: {
      FormDropdownMenuFilter: true,
      FormDropdownMenuActions: true
    },
    mocks: {
      $t: (key: string) => key
    }
  }

  it('renders empty state when no items', () => {
    render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        items: []
      },
      global: globalConfig
    })

    expect(screen.getByLabelText('g.noItems')).toBeVisible()
  })

  it.for(['grid', 'list', 'list-small'] satisfies LayoutMode[])(
    'selects a rendered item in %s layout',
    async (layoutMode) => {
      const { emitted } = render(FormDropdownMenu, {
        props: { ...defaultProps, layoutMode },
        global: globalConfig
      })

      await userEvent.click(screen.getByText('Item 2'))
      expect(emitted('item-click')).toEqual([[defaultProps.items[1], 1]])
    }
  )

  it('renders later pages loaded by the real grid', async () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class extends IntersectionObserver {
        constructor(private callback: IntersectionObserverCallback) {
          super(callback)
        }

        override observe(target: Element) {
          this.callback(
            [
              {
                target,
                time: 0,
                isIntersecting: true,
                intersectionRatio: 1,
                boundingClientRect: new DOMRect(),
                intersectionRect: new DOMRect(),
                rootBounds: null
              }
            ],
            this
          )
        }
      }
    )
    const items = ref<FormDropdownItem[]>([])
    const hasMore = ref(true)
    render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        items: mockPagedList({
          items,
          hasMore,
          loadMore: async () => {
            items.value = [createItem('later', 'Later page')]
            hasMore.value = false
            return true
          }
        })
      },
      global: globalConfig
    })

    await waitFor(() => expect(screen.getByText('Later page')).toBeVisible())
  })

  it('shows the loading-more row only while the paged list is loading', async () => {
    const { rerender } = render(FormDropdownMenu, {
      props: {
        ...defaultProps,
        items: mockPagedList<FormDropdownItem>({
          isLoading: true,
          hasMore: true
        })
      },
      global: globalConfig
    })

    expect(screen.getByTestId('form-dropdown-loading-more')).toBeTruthy()

    await rerender({
      ...defaultProps,
      items: mockPagedList({
        isLoading: true,
        hasMore: true,
        items: defaultProps.items
      })
    })

    expect(screen.getByText('Item 2')).toBeVisible()
    expect(screen.getByTestId('form-dropdown-loading-more')).toBeVisible()

    await rerender({
      ...defaultProps,
      items: mockPagedList<FormDropdownItem>({
        isLoading: false,
        items: defaultProps.items
      })
    })

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
        plugins: globalConfig.plugins,
        stubs: {
          FormDropdownMenuFilter: FormDropdownMenuFilterStub,
          FormDropdownMenuActions: true
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
        plugins: globalConfig.plugins,
        stubs: {
          FormDropdownMenuFilter: FormDropdownMenuFilterStub,
          FormDropdownMenuActions: true
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
