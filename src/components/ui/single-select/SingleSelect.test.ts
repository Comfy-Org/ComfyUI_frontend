import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'vue-component-type-helpers'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { raiseModalLayer, releaseModalLayer } from '@/utils/modalLayerStack'

import SingleSelect from './SingleSelect.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        singleSelectDropdown: 'Single-select dropdown',
        search: 'Search',
        noResultsFound: 'No results found'
      }
    }
  }
})

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
      '<div @keydown.escape="onEsc"><SingleSelect v-model="sel" :options="options" label="Pick" v-bind="extraProps" /><button>After</button></div>',
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
    container: document.body.appendChild(document.createElement('div')),
    global: { plugins: [i18n] }
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

let openModal: HTMLElement | undefined

afterEach(() => {
  if (openModal) {
    releaseModalLayer(openModal)
    openModal = undefined
  }
})

describe('SingleSelect', () => {
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

  it('selects a filtered option with the keyboard', async () => {
    const user = userEvent.setup()
    const { unmount } = renderInParent(undefined, { searchable: true })

    await openSelect(screen.getByLabelText('Pick'))
    const searchInput = screen.getByRole('combobox', { name: 'Search' })
    await user.type(searchInput, 'C')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByLabelText('Pick')).toHaveTextContent('Option C')

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

  it('opens above a dialog registered with the modal z-index counter', async () => {
    openModal = document.createElement('div')
    raiseModalLayer(openModal)
    const dialogZIndex = Number(openModal.style.zIndex)
    const { unmount } = renderInParent()

    await openSelect(screen.getByLabelText('Pick'))

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(Number(content!.style.zIndex)).toBeGreaterThan(dialogZIndex)

    unmount()
  })

  it('opens above a dialog even when the caller passes its own contentStyle z-index', async () => {
    openModal = document.createElement('div')
    raiseModalLayer(openModal)
    const dialogZIndex = Number(openModal.style.zIndex)
    const { unmount } = renderInParent(undefined, {
      contentStyle: { zIndex: 3000 }
    })

    await openSelect(screen.getByLabelText('Pick'))

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(Number(content!.style.zIndex)).toBeGreaterThan(dialogZIndex)

    unmount()
  })

  it('lets a consumer class override the trigger variant it conflicts with', () => {
    const { unmount } = render(SingleSelect, {
      props: { modelValue: undefined, options, label: 'Pick' },
      attrs: { class: 'bg-transparent' },
      global: { plugins: [i18n] }
    })

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveClass('bg-transparent')
    expect(trigger).not.toHaveClass('bg-secondary-background')

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
