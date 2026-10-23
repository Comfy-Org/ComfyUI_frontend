import { render, screen } from '@testing-library/vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import userEvent from '@testing-library/user-event'
import { FocusScope } from 'reka-ui'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { nextTick, ref } from 'vue'

import MultiSelect from './MultiSelect.vue'
import type { MultiSelectProps } from './types'

const options = [
  { name: 'Option A', value: 'a' },
  { name: 'Option B', value: 'b' },
  { name: 'Option C', value: 'c' }
]

function renderInParent(
  multiSelectProps: Partial<ComponentProps<typeof MultiSelect>> = {},
  modelValue: { name: string; value: string }[] = []
) {
  const parentEscapeCount = { value: 0 }

  const Parent = {
    template:
      '<div @keydown.escape="onEsc"><MultiSelect v-model="sel" :options="options" v-bind="extraProps" /></div>',
    components: { MultiSelect },
    setup() {
      return {
        sel: ref(modelValue),
        options,
        extraProps: {
          accessibleLabel: 'Choose options',
          searchLabel: 'Search',
          searchPlaceholder: 'Search',
          emptyText: 'No results found',
          clearAllLabel: 'Clear all',
          formatSelectedCount: (count: number) => `${count} selected`,
          ...multiSelectProps
        },
        onEsc: () => {
          parentEscapeCount.value++
        }
      }
    }
  }

  const { unmount } = render(Parent, {
    container: document.body.appendChild(document.createElement('div'))
  })

  return { unmount, parentEscapeCount }
}

function dispatchEscape(element: Element) {
  element.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true
    })
  )
}

function findContentElement(): HTMLElement | null {
  return document.querySelector('[data-dismissable-layer]')
}

describe('MultiSelect', () => {
  it('requires copy independently for each enabled feature', () => {
    type Base = { accessibleLabel: string; emptyText: string }
    expectTypeOf<
      Base & { showSearchBox: true }
    >().not.toMatchTypeOf<MultiSelectProps>()
    expectTypeOf<
      Base & { showClearButton: true }
    >().not.toMatchTypeOf<MultiSelectProps>()
    expectTypeOf<
      Base & { showSelectedCount: true }
    >().not.toMatchTypeOf<MultiSelectProps>()
    expectTypeOf<{
      accessibleLabel: string
    }>().not.toMatchTypeOf<MultiSelectProps>()
    expectTypeOf<
      Base & {
        showSearchBox: boolean
        searchLabel: string
        showClearButton: boolean
        clearAllLabel: string
        showSelectedCount: boolean
        formatSelectedCount: (count: number) => string
      }
    >().toMatchTypeOf<MultiSelectProps>()
  })

  it.for([undefined, false] as const)(
    'allows omitted feature copy with flags=%s',
    async (enabled) => {
      const props = {
        accessibleLabel: 'Choose options',
        emptyText: 'Nothing available',
        showSearchBox: enabled,
        showClearButton: enabled,
        showSelectedCount: enabled,
        modelValue: []
      } satisfies MultiSelectProps & { modelValue: [] }
      render(MultiSelect, { props })
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Choose options' }))
      expect(screen.getByText('Nothing available')).toBeVisible()
      expect(screen.queryByRole('combobox')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
    }
  )

  it.for(['header', 'footer'] as const)(
    'renders caller text and updates formatted counts in the %s',
    async (actionsPlacement) => {
      const user = userEvent.setup()
      const { unmount } = renderInParent(
        {
          accessibleLabel: 'Choisir',
          searchLabel: 'Rechercher',
          emptyText: 'Aucun résultat',
          clearAllLabel: 'Tout effacer',
          formatSelectedCount: (count) => `${count} choisis`,
          showSearchBox: true,
          showSelectedCount: true,
          showClearButton: true,
          actionsPlacement
        },
        [options[0], options[1]]
      )

      await user.click(screen.getByRole('button', { name: 'Choisir' }))
      expect(screen.getByRole('combobox', { name: 'Rechercher' })).toBeVisible()
      expect(screen.getByText('2 choisis')).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Tout effacer' }))
      expect(screen.getByText('0 choisis')).toBeVisible()
      await user.type(
        screen.getByRole('combobox', { name: 'Rechercher' }),
        'zzz'
      )
      expect(screen.getByText('Aucun résultat')).toBeVisible()
      unmount()
    }
  )

  it('opens above a dialog already in the document', async () => {
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const dialog = screen.getByTestId('existing-overlay')
    const user = userEvent.setup()
    const { unmount } = renderInParent()

    await user.click(screen.getByRole('button'))
    await nextTick()

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(dialog.compareDocumentPosition(content!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    unmount()
  })

  it('opens above a dialog even when the caller passes its own contentStyle z-index', async () => {
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const dialog = screen.getByTestId('existing-overlay')
    const user = userEvent.setup()
    const { unmount } = renderInParent({ contentStyle: { zIndex: 3000 } })

    await user.click(screen.getByRole('button'))
    await nextTick()

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(dialog.compareDocumentPosition(content!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    unmount()
  })

  it('keeps open-state border styling available while the dropdown is open', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent()

    const trigger = screen.getByRole('button')

    expect(trigger).toHaveClass('data-[state=open]:border-border')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    await nextTick()

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('data-state', 'open')

    unmount()
  })

  describe('Escape key propagation', () => {
    it('stops Escape from propagating to parent when popover is open', async () => {
      const user = userEvent.setup()
      const { unmount, parentEscapeCount } = renderInParent()

      const trigger = screen.getByRole('button')
      await user.click(trigger)
      await nextTick()

      const content = findContentElement()
      expect(content).not.toBeNull()

      dispatchEscape(content!)
      await nextTick()

      expect(parentEscapeCount.value).toBe(0)

      unmount()
    })

    it('closes the popover when Escape is pressed', async () => {
      const user = userEvent.setup()
      const { unmount } = renderInParent()

      const trigger = screen.getByRole('button')
      await user.click(trigger)
      await nextTick()
      expect(trigger).toHaveAttribute('data-state', 'open')

      const content = findContentElement()
      dispatchEscape(content!)
      await nextTick()

      expect(trigger).toHaveAttribute('data-state', 'closed')

      unmount()
    })
  })

  describe('selected count badge', () => {
    it('shows selected count when items are selected', () => {
      const { unmount } = renderInParent({}, [
        { name: 'Option A', value: 'a' },
        { name: 'Option B', value: 'b' }
      ])

      expect(screen.getByText('2')).toBeInTheDocument()

      unmount()
    })

    it('does not show count badge when no items are selected', () => {
      const { unmount } = renderInParent()

      expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()

      unmount()
    })
  })

  it('shows selected option labels in the trigger', () => {
    const { unmount } = renderInParent({}, [
      { name: 'Option A', value: 'a' },
      { name: 'Option B', value: 'b' }
    ])

    expect(screen.getByText('Option A, Option B')).toBeInTheDocument()

    unmount()
  })

  it('renders the value slot with the selected options instead of the joined labels', () => {
    const Parent = {
      template: `
        <MultiSelect v-model="sel" :options="options" accessible-label="Choose options" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)">
          <template #value="{ selected }">
            <span v-for="item in selected" :key="item.value" data-testid="chip">
              {{ item.name }}
            </span>
          </template>
        </MultiSelect>`,
      components: { MultiSelect },
      setup: () => ({
        sel: ref([options[0], options[2]]),
        options
      })
    }

    const { unmount } = render(Parent)

    expect(
      screen.getAllByTestId('chip').map((chip) => chip.textContent.trim())
    ).toEqual(['Option A', 'Option C'])
    expect(screen.queryByText('Option A, Option C')).not.toBeInTheDocument()

    unmount()
  })

  it('lets the user type in the search box when nested in a trapped focus scope', async () => {
    const user = userEvent.setup()
    const InTrap = {
      components: { FocusScope, MultiSelect },
      template: `
        <FocusScope trapped as-child>
          <div>
            <MultiSelect v-model="sel" :options="options" :show-search-box="true" accessible-label="Choose options" search-label="Search" search-placeholder="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)" />
          </div>
        </FocusScope>`,
      setup: () => ({ sel: ref([]), options })
    }

    const { unmount } = render(InTrap, {
      container: document.body.appendChild(document.createElement('div'))
    })

    await user.click(screen.getByRole('button'))
    await nextTick()

    const searchBox = screen.getByPlaceholderText('Search')
    await user.click(searchBox)
    await user.type(searchBox, 'query')
    await nextTick()

    expect(searchBox).toHaveFocus()
    expect(searchBox).toHaveValue('query')

    unmount()
  })
})
