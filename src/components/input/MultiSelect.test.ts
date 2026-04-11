import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import MultiSelect from './MultiSelect.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        multiSelectDropdown: 'Multi-select dropdown',
        noResultsFound: 'No results found',
        search: 'Search',
        clearAll: 'Clear all',
        itemsSelected: 'Items selected'
      }
    }
  }
})

const options = [
  { name: 'Option A', value: 'a' },
  { name: 'Option B', value: 'b' },
  { name: 'Option C', value: 'c' }
]

function renderInParent(
  multiSelectProps: Record<string, unknown> = {},
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
        extraProps: multiSelectProps,
        onEsc: () => {
          parentEscapeCount.value++
        }
      }
    }
  }

  const { unmount } = render(Parent, {
    container: document.body.appendChild(document.createElement('div')),
    global: { plugins: [i18n] }
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
  it('keeps open-state border styling available while the dropdown is open', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent()

    const trigger = screen.getByRole('button')

    expect(trigger).toHaveClass(
      'data-[state=open]:border-node-component-border'
    )
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
})
