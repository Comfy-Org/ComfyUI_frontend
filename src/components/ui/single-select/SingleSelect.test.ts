import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'vue-component-type-helpers'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { nextTick, ref } from 'vue'

import SingleSelect from './SingleSelect.vue'
import type { SingleSelectProps } from './types'

const options = [
  { name: 'Option A', value: 'a' },
  { name: 'Option B', value: 'b' },
  { name: 'Option C', value: 'c' }
]

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

function renderInParent(
  modelValue?: string,
  singleSelectProps: Partial<ComponentProps<typeof SingleSelect>> = {}
) {
  const parentEscapeCount = { value: 0 }

  const Parent = {
    template:
      '<div @keydown.escape="onEsc"><SingleSelect v-model="sel" :options="options" label="Pick" accessible-label="Pick" search-label="Search" search-placeholder="Search" empty-text="No results found" v-bind="extraProps" /><button>After</button></div>',
    components: { SingleSelect },
    setup() {
      return {
        sel: ref(modelValue),
        options,
        extraProps: singleSelectProps,
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

async function openSelect(triggerEl: HTMLElement) {
  if (!Reflect.has(triggerEl, 'hasPointerCapture')) {
    triggerEl.hasPointerCapture = () => false
    triggerEl.releasePointerCapture = () => {}
  }
  triggerEl.dispatchEvent(
    new PointerEvent('pointerdown', {
      button: 0,
      pointerType: 'mouse',
      bubbles: true
    })
  )
  await nextTick()
  if (triggerEl.dataset.state === 'closed') {
    triggerEl.click()
    await nextTick()
  }
}

describe('SingleSelect', () => {
  it('requires search copy only when searching can be enabled', () => {
    expectTypeOf<{
      accessibleLabel: string
      searchable: true
    }>().not.toMatchTypeOf<SingleSelectProps>()
    expectTypeOf<{
      accessibleLabel: string
      searchable: true
      searchLabel: string
    }>().not.toMatchTypeOf<SingleSelectProps>()
    expectTypeOf<{
      accessibleLabel: string
      searchable: boolean
      emptyText: string
    }>().not.toMatchTypeOf<SingleSelectProps>()
    expectTypeOf<{
      accessibleLabel: string
      searchable: boolean
      searchLabel: string
      emptyText: string
    }>().toMatchTypeOf<SingleSelectProps>()
    expectTypeOf<{
      searchable: false
    }>().not.toMatchTypeOf<SingleSelectProps>()
  })

  it.for([undefined, false] as const)(
    'allows omitted search copy with searchable=%s',
    async (searchable) => {
      const props = {
        accessibleLabel: 'Choose an option',
        searchable,
        options,
        modelValue: undefined
      } satisfies SingleSelectProps & { modelValue: undefined }
      render(SingleSelect, { props })
      await openSelect(screen.getByLabelText('Choose an option'))
      expect(screen.getByRole('option', { name: 'Option A' })).toBeVisible()
      expect(screen.queryByRole('combobox', { name: 'Search' })).toBeNull()
    }
  )

  it('renders caller search and empty text without an i18n plugin', async () => {
    const user = userEvent.setup()
    render(SingleSelect, {
      props: {
        modelValue: undefined,
        options,
        searchable: true,
        label: 'Catégorie',
        accessibleLabel: 'Choisir une catégorie',
        searchLabel: 'Rechercher',
        searchPlaceholder: 'Rechercher...',
        emptyText: 'Aucun résultat'
      }
    })
    await openSelect(
      screen.getByRole('button', { name: 'Choisir une catégorie' })
    )
    const searchInput = screen.getByRole('combobox', { name: 'Rechercher' })
    expect(searchInput).toHaveAttribute('placeholder', 'Rechercher...')
    await user.type(searchInput, 'zzz')
    expect(screen.getByText('Aucun résultat')).toBeVisible()
  })

  it('filters searchable options', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent(undefined, { searchable: true })

    await openSelect(screen.getByLabelText('Pick'))
    const searchInput = screen.getByRole('combobox', { name: 'Search' })
    expect(searchInput).toHaveFocus()
    await user.type(searchInput, 'C')

    expect(screen.getByRole('option', { name: 'Option C' })).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'Option A' })
    ).not.toBeInTheDocument()

    unmount()
  })

  it('keeps a keyboard-selected option when reopened', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent(undefined, { searchable: true })

    await openSelect(screen.getByLabelText('Pick'))
    const searchInput = screen.getByRole('combobox', { name: 'Search' })
    await user.type(searchInput, 'C')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByLabelText('Pick')).toHaveTextContent('Option C')
    await openSelect(screen.getByLabelText('Pick'))
    expect(screen.getByRole('option', { name: 'Option C' })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    unmount()
  })

  it('shows an empty result and keeps the search input focused', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent(undefined, { searchable: true })

    await openSelect(screen.getByLabelText('Pick'))
    const searchInput = screen.getByRole('combobox', { name: 'Search' })
    await user.type(searchInput, 'missing')

    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(searchInput).toHaveFocus()

    unmount()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent(undefined, { searchable: true })

    const trigger = screen.getByLabelText('Pick')
    await openSelect(trigger)
    await user.keyboard('{Escape}')

    expect(trigger).toHaveAttribute('data-state', 'closed')
    expect(trigger).toHaveFocus()

    unmount()
  })

  it('keeps the searchable trigger in the keyboard tab order', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent(undefined, { searchable: true })

    await user.tab()

    expect(screen.getByRole('button', { name: 'Pick' })).toHaveFocus()

    unmount()
  })

  it('clears the search and restores focus when reopened', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent(undefined, { searchable: true })

    const trigger = screen.getByLabelText('Pick')
    await openSelect(trigger)
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'C')
    await user.keyboard('{Escape}')
    await openSelect(trigger)

    const searchInput = screen.getByRole('combobox', { name: 'Search' })
    expect(searchInput).toHaveValue('')
    expect(searchInput).toHaveFocus()
    expect(screen.getAllByRole('option')).toHaveLength(3)

    unmount()
  })

  it('opens above a dialog already in the document', async () => {
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const dialog = screen.getByTestId('existing-overlay')
    const { unmount } = renderInParent()

    await openSelect(screen.getByLabelText('Pick'))

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
    const { unmount } = renderInParent(undefined, {
      contentStyle: { zIndex: 3000 }
    })

    await openSelect(screen.getByLabelText('Pick'))

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(dialog.compareDocumentPosition(content!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    unmount()
  })

  it('lets a consumer class override the trigger variant it conflicts with', () => {
    const { unmount } = render(SingleSelect, {
      props: {
        modelValue: undefined,
        options,
        label: 'Pick',
        accessibleLabel: 'Pick',
        searchLabel: 'Search',
        emptyText: 'No results found'
      },
      attrs: { class: 'bg-transparent' }
    })

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveClass('bg-transparent')
    expect(trigger).not.toHaveClass('bg-secondary')

    unmount()
  })

  describe('Escape key propagation', () => {
    it('stops Escape from propagating to parent when popover is open', async () => {
      const { unmount, parentEscapeCount } = renderInParent(undefined, {
        searchable: true
      })

      const trigger = screen.getByLabelText('Pick')
      await openSelect(trigger)

      const content = findContentElement()
      expect(content).not.toBeNull()

      dispatchEscape(content!)
      await nextTick()

      expect(parentEscapeCount.value).toBe(0)

      unmount()
    })

    it('closes the popover when Escape is pressed', async () => {
      const { unmount } = renderInParent()

      const trigger = screen.getByRole('combobox')
      await openSelect(trigger)
      expect(trigger).toHaveAttribute('data-state', 'open')

      const content = findContentElement()
      dispatchEscape(content!)
      await nextTick()

      expect(trigger).toHaveAttribute('data-state', 'closed')

      unmount()
    })
  })
})
