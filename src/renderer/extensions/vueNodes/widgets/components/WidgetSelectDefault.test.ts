import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

vi.mock('reka-ui', async () => {
  const actual = (await vi.importActual('reka-ui')) as Record<string, unknown>
  return {
    ...actual,
    ComboboxVirtualizer: defineComponent({
      name: 'ComboboxVirtualizerStub',
      props: {
        options: Array,
        estimateSize: Number,
        textContent: Function
      },
      setup(props, { slots }) {
        return () =>
          (props.options ?? []).flatMap(
            (option) => slots.default?.({ option }) ?? []
          )
      }
    })
  }
})

import WidgetSelectDefault from './WidgetSelectDefault.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        noResultsFound: 'No results found',
        loading: 'Loading...',
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
      expect(screen.getByRole('status')).toHaveTextContent('No results found')
    })

    it('resolves options from a function', async () => {
      const { user } = renderComponent(createWidget(() => ['a', 'b', 'c']))

      await openDropdown(user)

      expect(optionLabels()).toEqual(['a', 'b', 'c'])
    })

    it('falls back to empty options when function values throw', async () => {
      const error = new Error('failed to load values')
      const values = vi.fn(() => {
        throw error
      })
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      try {
        const { user } = renderComponent(createWidget(values))

        await openDropdown(user)

        expect(optionLabels()).toEqual([])
        expect(screen.getByRole('status')).toHaveTextContent('No results found')
        expect(consoleError).toHaveBeenCalledWith(
          '[WidgetSelectDefault] Failed to resolve options',
          error
        )
      } finally {
        consoleError.mockRestore()
      }
    })

    it('re-evaluates function values when opened', async () => {
      let items = ['x', 'y']
      const { user } = renderComponent(createWidget(() => items))

      items = ['x', 'y', 'z']
      await openDropdown(user)

      expect(optionLabels()).toEqual(['x', 'y', 'z'])
    })

    it('does not re-evaluate function values on each search keystroke', async () => {
      let items = ['alpha', 'bravo', 'charlie', 'delta', 'echo']
      const values = vi.fn(() => items)
      const { user } = renderComponent(createWidget(values))

      await openDropdown(user)
      values.mockClear()
      items = ['alpha', 'bravo', 'charlie', 'delta', 'zeta']
      await user.type(screen.getByRole('combobox', { name: 'Search' }), 'z')

      expect(values).not.toHaveBeenCalled()
      expect(optionLabels()).toEqual([])
    })

    it('does not remap array option labels on each search keystroke', async () => {
      const getOptionLabel = vi.fn((value?: string | null) => value ?? '')
      const { user } = renderComponent(
        createWidget(['alpha', 'bravo', 'charlie', 'delta', 'echo'], {
          getOptionLabel
        })
      )

      await openDropdown(user)
      getOptionLabel.mockClear()
      await user.type(screen.getByRole('combobox', { name: 'Search' }), 'alp')

      expect(getOptionLabel).not.toHaveBeenCalled()
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

    it('allows selecting an explicit empty string option', async () => {
      const { onUpdate, user } = renderComponent(
        createWidget(['filled', ''], {
          getOptionLabel: (value?: string | null) =>
            value === '' ? 'Empty option' : value
        }),
        'filled'
      )

      await openDropdown(user)
      await user.click(screen.getByRole('option', { name: 'Empty option' }))

      expect(onUpdate).toHaveBeenCalledWith('')
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

    it('does not emit a blank value when Escape closes the dropdown', async () => {
      const { onUpdate, user } = renderComponent(
        createWidget(['alpha', 'bravo', 'charlie', 'delta', 'echo']),
        'alpha'
      )

      await openDropdown(user)
      await user.keyboard('{Escape}')

      expect(onUpdate).not.toHaveBeenCalledWith('')
    })

    it('does not select an empty string option when Escape closes the dropdown', async () => {
      const { onUpdate, user } = renderComponent(
        createWidget(['alpha', ''], {
          getOptionLabel: (value?: string | null) =>
            value === '' ? 'Empty option' : value
        }),
        'alpha'
      )

      await openDropdown(user)
      await user.keyboard('{Escape}')

      expect(onUpdate).not.toHaveBeenCalledWith('')
    })
  })

  describe('focus restore behavior', () => {
    it('keeps the search focused when viewport pointerdown causes focus outside', async () => {
      const { user } = renderComponent(
        createWidget(['alpha', 'bravo', 'charlie', 'delta', 'echo'])
      )
      const outsideButton = document.createElement('button')
      document.body.append(outsideButton)

      try {
        await openDropdown(user)
        const searchInput = screen.getByRole('combobox', { name: 'Search' })
        const viewport = screen.getByTestId('widget-select-default-viewport')

        // user-event does not model the raw viewport pointerdown that triggers
        // this Reka focus-outside interaction.
        // eslint-disable-next-line testing-library/prefer-user-event
        await fireEvent.pointerDown(viewport)
        outsideButton.focus()
        await fireEvent.focusIn(outsideButton)

        await waitFor(() => {
          expect(searchInput).toHaveFocus()
        })
        expect(viewport).toBeVisible()
      } finally {
        outsideButton.remove()
      }
    })
  })

  describe('loading state', () => {
    it('displays a loading spinner and hides options when initially opened, then resolves options', async () => {
      const options = Array.from({ length: 101 }, (_, i) => `option-${i}`)
      renderComponent(createWidget(options))

      // fireEvent required: userEvent simulates delays that skip our 0ms timeout
      // eslint-disable-next-line testing-library/prefer-user-event
      await fireEvent.click(screen.getByTestId('widget-select-default-trigger'))
      await nextTick()

      const icon = screen.getByTestId('widget-select-trigger-icon')
      expect(icon).toHaveClass('animate-spin')
      expect(screen.getByTestId('widget-select-default-loading')).toBeVisible()
      expect(screen.queryAllByRole('option')).toHaveLength(0)

      await flushPromises()
      await nextTick()

      expect(icon).not.toHaveClass('animate-spin')
      expect(
        screen.queryByTestId('widget-select-default-loading')
      ).not.toBeInTheDocument()
      expect(optionLabels()).toEqual(options)
    })

    it('cancels the pending resolve timer when the dropdown is closed early', async () => {
      vi.useFakeTimers()
      try {
        const options = Array.from({ length: 101 }, (_, i) => `option-${i}`)
        renderComponent(createWidget(options))

        // eslint-disable-next-line testing-library/prefer-user-event
        await fireEvent.click(
          screen.getByTestId('widget-select-default-trigger')
        )
        await nextTick()

        const icon = screen.getByTestId('widget-select-trigger-icon')
        expect(icon).toHaveClass('animate-spin')

        const pendingTimersBeforeClose = vi.getTimerCount()

        const overlay = screen.getByTestId('widget-select-default-overlay')
        // eslint-disable-next-line testing-library/prefer-user-event
        await fireEvent.keyDown(overlay, { key: 'Escape', code: 'Escape' })
        await nextTick()

        const pendingTimersAfterClose = vi.getTimerCount()
        expect(pendingTimersAfterClose).toBeLessThan(pendingTimersBeforeClose)

        expect(
          screen.queryByTestId('widget-select-default-loading')
        ).not.toBeInTheDocument()

        vi.advanceTimersByTime(0)
        await nextTick()

        // eslint-disable-next-line testing-library/prefer-user-event
        await fireEvent.click(
          screen.getByTestId('widget-select-default-trigger')
        )
        await nextTick()

        expect(icon).toHaveClass('animate-spin')
        expect(
          screen.getByTestId('widget-select-default-loading')
        ).toBeVisible()
      } finally {
        vi.useRealTimers()
      }
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

    it('marks the dropdown overlay as wheel-capturing for canvas interactions', async () => {
      const { user } = renderComponent(
        createWidget(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
      )

      await openDropdown(user)

      expect(
        screen.getByTestId('widget-select-default-overlay')
      ).toHaveAttribute('data-capture-wheel', 'true')
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
