import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelectDefault from './WidgetSelectDefault.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        noResultsFound: 'No results found',
        search: 'Search'
      }
    }
  }
})

const WidgetLayoutFieldStub = defineComponent({
  name: 'WidgetLayoutField',
  template: '<div class="relative"><slot /></div>'
})

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('WidgetSelectDefault', () => {
  const createWidget = (
    values: unknown,
    options: Record<string, unknown> = {}
  ): SimplifiedWidget<string | undefined> => ({
    name: 'test_combo',
    type: 'combo',
    value: undefined,
    options: { values, ...options } as SimplifiedWidget['options']
  })

  function renderComponent(
    widget: SimplifiedWidget<string | undefined>,
    modelValue?: string,
    slots?: Record<string, string>
  ) {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    const result = render(WidgetSelectDefault, {
      props: {
        widget,
        modelValue,
        'onUpdate:modelValue': onUpdate
      },
      slots,
      global: {
        plugins: [i18n],
        stubs: {
          WidgetLayoutField: WidgetLayoutFieldStub
        }
      }
    })

    return { ...result, onUpdate, user }
  }

  async function openDropdown(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('widget-select-default-trigger'))
    await nextTick()
    await flushPromises()
  }

  const optionLabels = () =>
    screen.queryAllByRole('option').map((option) => option.textContent?.trim())

  async function expectHighlightedOption(name: string) {
    await waitFor(() => {
      expect(screen.getByRole('option', { name })).toHaveAttribute(
        'data-highlighted'
      )
    })
  }

  describe('option sources', () => {
    it('resolves options from a plain array', async () => {
      const { user } = renderComponent(createWidget(['a', 'b', 'c']))

      await openDropdown(user)

      expect(optionLabels()).toEqual(['a', 'b', 'c'])
    })

    it('reactively updates when widget prop changes', async () => {
      const { rerender, user } = renderComponent(createWidget(['x', 'y']))

      await rerender({ widget: createWidget(['x', 'y', 'z']) })
      await openDropdown(user)

      expect(optionLabels()).toEqual(['x', 'y', 'z'])
    })

    it('returns empty options when values is undefined', async () => {
      const { user } = renderComponent(createWidget(undefined))

      await openDropdown(user)

      expect(optionLabels()).toEqual([])
      expect(screen.getByText('No results found')).toBeInTheDocument()
    })

    it('resolves options from a function', async () => {
      const { user } = renderComponent(createWidget(() => ['a', 'b', 'c']))

      await openDropdown(user)

      expect(optionLabels()).toEqual(['a', 'b', 'c'])
    })

    it('re-evaluates function values when opened', async () => {
      let items = ['x', 'y']
      const { user } = renderComponent(createWidget(() => items))

      items = ['x', 'y', 'z']
      await openDropdown(user)

      expect(optionLabels()).toEqual(['x', 'y', 'z'])
    })

    it('re-evaluates function values when searched', async () => {
      let items = ['alpha', 'bravo', 'charlie', 'delta', 'echo']
      const { user } = renderComponent(createWidget(() => items))

      await openDropdown(user)
      items = ['alpha', 'bravo', 'charlie', 'delta', 'zeta']
      await user.type(screen.getByRole('combobox', { name: 'Search' }), 'z')

      await waitFor(() => {
        expect(optionLabels()).toEqual(['zeta'])
      })
    })
  })

  describe('selection behavior', () => {
    it('emits model updates when an option is selected', async () => {
      const { onUpdate, user } = renderComponent(
        createWidget(['a', 'b', 'c']),
        'a'
      )

      await openDropdown(user)
      await user.click(screen.getByRole('option', { name: 'b' }))

      expect(onUpdate).toHaveBeenCalledWith('b')
    })

    it('emits model updates when the current value is undefined', async () => {
      const { onUpdate, user } = renderComponent(createWidget(['a', 'b', 'c']))

      await openDropdown(user)
      await user.click(screen.getByRole('option', { name: 'b' }))

      expect(onUpdate).toHaveBeenCalledWith('b')
    })

    it('selects the top filtered result when Enter is pressed after typing', async () => {
      const { onUpdate, user } = renderComponent(
        createWidget(['alpha', 'bravo', 'charlie', 'delta', 'echo']),
        ''
      )

      await openDropdown(user)
      await user.type(screen.getByRole('combobox', { name: 'Search' }), 'alp')
      await expectHighlightedOption('alpha')
      await user.keyboard('{Enter}')

      expect(onUpdate).toHaveBeenCalledWith('alpha')
    })

    it('allows Arrow navigation followed by Enter to select a filtered result', async () => {
      const { onUpdate, user } = renderComponent(
        createWidget(['alpha', 'alpine', 'bravo', 'charlie', 'delta']),
        ''
      )

      await openDropdown(user)
      await user.type(screen.getByRole('combobox', { name: 'Search' }), 'al')
      await expectHighlightedOption('alpha')
      await user.keyboard('{ArrowDown}{Enter}')

      expect(onUpdate).toHaveBeenCalledWith('alpine')
    })
  })

  describe('rendered state', () => {
    it('shows the filter input only when there are more than four options', async () => {
      const { user, rerender } = renderComponent(createWidget(['a', 'b', 'c']))

      await openDropdown(user)
      expect(
        screen.queryByRole('combobox', { name: 'Search' })
      ).not.toBeInTheDocument()

      await user.keyboard('{Escape}')
      await rerender({
        widget: createWidget(['a', 'b', 'c', 'd', 'e'])
      })
      await openDropdown(user)

      expect(screen.getByRole('combobox', { name: 'Search' })).toBeVisible()
    })

    it('captures wheel events and shows a stable scrollbar gutter for long lists', async () => {
      const { user } = renderComponent(
        createWidget(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
      )

      await openDropdown(user)

      expect(
        screen.getByTestId('widget-select-default-overlay')
      ).toHaveAttribute('data-capture-wheel', 'true')
      expect(screen.getByTestId('widget-select-default-viewport')).toHaveClass(
        'scrollbar-gutter-stable',
        'scrollbar-thin',
        'scrollbar-thumb-(--color-alpha-smoke-500-50)',
        'scrollbar-track-transparent',
        'gap-0.5'
      )
      expect(screen.getByTestId('widget-select-default-viewport')).toHaveStyle({
        overflowY: 'scroll'
      })
    })

    it('shows invalid current values as the trigger label', () => {
      renderComponent(createWidget(['a', 'b']), 'missing')

      expect(
        screen.getByTestId('widget-select-default-trigger')
      ).toHaveTextContent('missing')
      expect(
        screen.getByTestId('widget-select-default-trigger')
      ).toHaveAttribute('aria-invalid', 'true')
    })

    it('disables the trigger when widget options are disabled', () => {
      renderComponent(createWidget(['a'], { disabled: true }), 'a')

      expect(screen.getByTestId('widget-select-default-trigger')).toBeDisabled()
    })

    it('uses getOptionLabel for trigger and option labels', async () => {
      const { user } = renderComponent(
        createWidget(['hash-a'], {
          getOptionLabel: (value?: string | null) => `File: ${value}`
        }),
        'hash-a'
      )

      expect(
        screen.getByTestId('widget-select-default-trigger')
      ).toHaveTextContent('File: hash-a')

      await openDropdown(user)
      expect(screen.getByRole('option', { name: 'File: hash-a' })).toBeVisible()
    })

    it('preserves the default slot for WidgetWithControl controls', () => {
      renderComponent(createWidget(['a']), 'a', {
        default: '<button data-testid="control-slot">control</button>'
      })

      expect(screen.getByTestId('control-slot')).toBeInTheDocument()
    })
  })
})
