import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'

import WidgetSelectDefault from './WidgetSelectDefault.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  escapeParameter: true,
  messages: {
    en: {
      g: {
        noResultsFound: 'No results found',
        search: 'Search',
        back: 'Back',
        previous: 'Previous',
        next: 'Next'
      },
      widgets: {
        selectFolder: 'Folder: {name}',
        backFromFolder: 'Back: {name}'
      }
    }
  }
})

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('WidgetSelectDefault', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(1000)
  })

  const createWidget = (
    values: unknown,
    options: Record<string, unknown> = {}
  ): SimplifiedWidget<string | undefined> => ({
    name: 'test_combo',
    type: 'combo',
    value: undefined,
    options: { values, ...options }
  })

  function renderComponent(
    widget: SimplifiedWidget<string | undefined>,
    modelValue?: WidgetValue,
    slots?: Record<string, string>,
    filenameSummary = false
  ) {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    const result = render(WidgetSelectDefault, {
      props: {
        widget,
        modelValue,
        filenameSummary,
        'onUpdate:modelValue': onUpdate
      },
      slots,
      global: {
        plugins: [i18n]
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
    screen.queryAllByRole('option').map((option) => option.textContent.trim())

  it('opens from the gap in a unified row without changing its value', async () => {
    const user = userEvent.setup()
    const { emitted } = render(WidgetSelectDefault, {
      props: {
        widget: createWidget(['euler', 'heun']),
        modelValue: 'euler'
      },
      global: {
        plugins: [i18n]
      }
    })

    await user.click(screen.getByTestId('widget-row-hit-area'))

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(await screen.findByRole('listbox')).toBeVisible()
    expect(emitted()['update:modelValue']).toBeUndefined()
  })

  it.for([
    {
      raw: 'studio/models/portrait.safetensors',
      summary: 'portrait.safetensors',
      filenameSummary: true
    },
    {
      raw: 'C:\\models\\portrait.safetensors',
      summary: 'portrait.safetensors',
      filenameSummary: true
    }
  ])('displays $raw as $summary', ({ raw, summary, filenameSummary }) => {
    renderComponent(createWidget([raw]), raw, undefined, filenameSummary)
    expect(screen.getByRole('combobox').textContent.trim()).toBe(summary)
    expect(screen.getByRole('combobox')).not.toHaveAttribute('title')
  })

  it.for([
    { current: 42, action: 'Next', expected: 89 },
    { current: 42, action: 'Previous', expected: 11 },
    { current: 11, action: 'Next', expected: 42 },
    { current: 89, action: 'Previous', expected: 42 }
  ])(
    'steps $action from $current to raw value $expected',
    async ({ current, action, expected }) => {
      const { user, onUpdate } = renderComponent(
        createWidget([11, 42, 89]),
        current,
        undefined,
        false
      )
      await user.click(
        screen.getByRole('button', { name: `test_combo: ${action}` })
      )
      expect(onUpdate).toHaveBeenCalledWith(expected)
    }
  )

  it.for([
    { values: [11, 42, 89], current: 11, expected: [true, false] },
    { values: [11, 42, 89], current: 89, expected: [false, true] },
    { values: [11], current: 11, expected: [true, true] },
    { values: [], current: undefined, expected: [true, true] }
  ])(
    'disables unavailable directions for $values with current=$current',
    ({ values, current, expected }) => {
      renderComponent(createWidget(values), current)

      expect(
        [
          screen.getByRole('button', { name: 'test_combo: Previous' }),
          screen.getByRole('button', { name: 'test_combo: Next' })
        ].map((button) => button.hasAttribute('disabled'))
      ).toEqual(expected)
    }
  )

  it.for([
    { initial: [11, 42], action: 'Next', expected: 89 },
    { initial: [42, 89], action: 'Previous', expected: 11 }
  ])(
    'discovers new dynamic options with $action without opening the popup',
    async ({ initial, action, expected }) => {
      let values = initial
      const { user, onUpdate } = renderComponent(
        createWidget(() => values),
        42,
        undefined,
        false
      )
      const arrow = screen.getByRole('button', {
        name: `test_combo: ${action}`
      })

      await user.click(arrow)
      expect(onUpdate).not.toHaveBeenCalled()

      values = [11, 42, 89]
      await user.click(arrow)

      expect(onUpdate).toHaveBeenCalledWith(expected)
      expect(screen.getByRole('combobox')).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    }
  )

  it('keeps custom labels intact when filename summaries are requested', () => {
    renderComponent(
      createWidget(['studio/model.safetensors'], {
        getOptionLabel: () => 'Studio / approved'
      }),
      'studio/model.safetensors',
      undefined,
      true
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Studio / approved')
  })

  it.for([
    {
      first: 'studio/models/portrait.safetensors',
      second: 'archive/models/portrait.safetensors',
      unifiedRows: false
    },
    {
      first: '/studio/models/portrait.safetensors',
      second: 'studio/models/portrait.safetensors',
      unifiedRows: true
    }
  ])(
    'distinguishes $first from $second and emits the raw path',
    async ({ first, second, unifiedRows }) => {
      const { user, onUpdate } = renderComponent(
        createWidget([first, second]),
        first,
        undefined,
        true,
        unifiedRows
      )
      await openDropdown(user)
      expect(screen.getByRole('option', { name: first })).toBeVisible()
      await user.click(screen.getByRole('option', { name: second }))
      expect(onUpdate).toHaveBeenCalledWith(second)
    }
  )

  it.for([
    { path: 'studio/models/portrait.safetensors' },
    { path: 'studio\\models\\portrait.safetensors' },
    { path: '/studio//models/portrait.safetensors' },
    { path: '\\\\studio\\models\\portrait.safetensors' }
  ])(
    'browses nested folders without changing $path until a file is selected',
    async ({ path }) => {
      const { user, onUpdate } = renderComponent(
        createWidget(['None', path, 'other/portrait.safetensors']),
        'None',
        undefined,
        true,
        true
      )
      await openDropdown(user)
      expect(optionLabels()).toEqual(['studio', 'other', 'None'])
      await user.click(screen.getByRole('option', { name: 'Folder: studio' }))
      await user.click(screen.getByRole('option', { name: 'Folder: models' }))
      expect(
        screen.getByRole('option', { name: 'Back: studio / models' })
      ).toBeVisible()
      expect(onUpdate).not.toHaveBeenCalled()
      expect(screen.getByRole('combobox', { name: 'Search' })).toHaveFocus()
      await user.click(
        screen.getByRole('option', { name: 'Back: studio / models' })
      )
      expect(
        screen.getByRole('option', { name: 'Folder: models' })
      ).toBeVisible()
      await user.click(screen.getByRole('option', { name: 'Folder: models' }))
      await user.click(
        screen.getByRole('option', { name: 'portrait.safetensors' })
      )
      expect(onUpdate).toHaveBeenCalledWith(path)
      expect(
        screen.queryByTestId('widget-select-default-overlay')
      ).not.toBeInTheDocument()
    }
  )

  it.for([
    'studio/models/portrait.safetensors',
    'studio\\models\\portrait.safetensors',
    '/studio//models/portrait.safetensors',
    '\\\\studio\\models\\portrait.safetensors'
  ])('opens the directory containing the selected %s', async (path) => {
    const { user, onUpdate } = renderComponent(
      createWidget(['None', path, 'archive/portrait.safetensors']),
      path,
      undefined,
      true,
      true
    )
    await openDropdown(user)
    expect(optionLabels()).toEqual(['studio / models', 'portrait.safetensors'])
    expect(
      screen.getByRole('option', {
        name: 'portrait.safetensors',
        selected: true
      })
    ).toBeVisible()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('searches every directory and preserves duplicate filename identities', async () => {
    const { user, onUpdate } = renderComponent(
      createWidget([
        'None',
        'studio/portrait.safetensors',
        'archive/portrait.safetensors'
      ]),
      'None',
      undefined,
      true,
      true
    )
    await openDropdown(user)
    const search = screen.getByRole('combobox', { name: 'Search' })
    const listbox = screen.getByRole('listbox', { name: 'test_combo' })
    expect(listbox).not.toContainElement(search)
    expect(search).toHaveAttribute('aria-controls', listbox.id)
    await user.click(screen.getByRole('option', { name: 'Folder: studio' }))
    await user.type(search, 'missing')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(listbox).not.toContainElement(screen.getByRole('status'))
    expect(search).not.toHaveAttribute('aria-activedescendant')
    expect(search).toHaveFocus()
    await user.clear(search)
    await user.type(
      screen.getByRole('combobox', { name: 'Search' }),
      'PORTRAIT'
    )
    expect(optionLabels()).toEqual([
      'studio/portrait.safetensors',
      'archive/portrait.safetensors'
    ])
    await user.click(
      screen.getByRole('option', { name: 'archive/portrait.safetensors' })
    )
    expect(onUpdate).toHaveBeenCalledWith('archive/portrait.safetensors')
  })

  it('navigates into and out of folders with the keyboard before selecting a file', async () => {
    const { user, onUpdate } = renderComponent(
      createWidget(['studio/models/portrait.safetensors']),
      '',
      undefined,
      true,
      true
    )
    await openDropdown(user)
    await user.keyboard('{Home}{Enter}')
    await expectHighlightedOption('Back: studio')
    await user.keyboard('{ArrowDown}{Enter}')
    await expectHighlightedOption('Back: studio / models')
    await user.keyboard('{Enter}')
    await expectHighlightedOption('Back: studio')
    expect(onUpdate).not.toHaveBeenCalled()
    await user.keyboard('{ArrowDown}{Enter}')
    await expectHighlightedOption('Back: studio / models')
    await user.keyboard('{End}')
    await expectHighlightedOption('portrait.safetensors')
    await user.keyboard('{Enter}')
    expect(onUpdate).toHaveBeenCalledWith('studio/models/portrait.safetensors')
  })

  it.for([
    {
      values: ['schedule/custom', 'N/A'],
      options: {},
      unifiedRows: true,
      labels: ['schedule/custom', 'N/A']
    },
    {
      values: ['studio/portrait.safetensors'],
      options: { getOptionLabel: () => 'Studio / approved' },
      unifiedRows: true,
      labels: ['Studio / approved']
    },
    {
      values: ['studio/portrait.safetensors'],
      options: {},
      unifiedRows: false,
      labels: ['studio/portrait.safetensors']
    }
  ])(
    'retains flat labels $labels outside unlabeled Nodes 2.0 file paths',
    async ({ values, options, unifiedRows, labels }) => {
      const { user } = renderComponent(
        createWidget(values, options),
        values[0],
        undefined,
        false,
        unifiedRows
      )
      await openDropdown(user)
      expect(optionLabels()).toEqual(labels)
    }
  )

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

      try {
        const { user } = renderComponent(createWidget(values))

        await openDropdown(user)

        expect(optionLabels()).toEqual([])
        expect(screen.getByRole('status')).toHaveTextContent('No results found')
        expect(console.error).toHaveBeenCalledWith(
          '[WidgetSelectDefault] Failed to resolve options',
          error
        )
      } finally {
        vi.mocked(console.error).mockRestore()
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

    it('keeps numeric values numeric when an option is selected', async () => {
      const { onUpdate, user } = renderComponent(createWidget([5, 10]), 5)

      await openDropdown(user)
      await user.click(screen.getByRole('option', { name: '10' }))

      expect(onUpdate).toHaveBeenCalledWith(10)
    })

    it('keeps boolean values boolean when an option is selected', async () => {
      const { onUpdate, user } = renderComponent(
        createWidget([true, false]),
        false
      )

      await openDropdown(user)
      await user.click(screen.getByRole('option', { name: 'true' }))

      expect(onUpdate).toHaveBeenCalledWith(true)
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
        // oxlint-disable-next-line testing-library/prefer-user-event
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

    it('treats a null value like no selection instead of an invalid value', () => {
      renderComponent(createWidget(['a', 'b']), null)

      const trigger = screen.getByTestId('widget-select-default-trigger')
      expect(trigger).not.toHaveAttribute('aria-invalid')
      expect(trigger.textContent.trim()).toBe('')
    })

    it('selects the first option when the value is undefined', () => {
      renderComponent(createWidget(['a', 'b']))

      expect(
        screen.getByTestId('widget-select-default-trigger')
      ).toHaveTextContent('a')
    })

    it('marks only a matching value as selected in the dropdown', async () => {
      const first = renderComponent(createWidget(['a', 'b']), null)

      await openDropdown(first.user)

      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(2)
      expect(options.map((option) => option.textContent.trim())).toEqual(
        expect.arrayContaining(['a', 'b'])
      )
      for (const option of options) {
        expect(option).not.toHaveAttribute('aria-selected', 'true')
      }
      first.unmount()

      const second = renderComponent(createWidget(['a', 'b']), 'a')

      await openDropdown(second.user)

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute(
        'aria-selected',
        'true'
      )
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

    it('does not mark a valid numeric option as invalid', () => {
      renderComponent(createWidget([5, 10]), 5)

      const trigger = screen.getByTestId('widget-select-default-trigger')
      expect(trigger).not.toHaveAttribute('aria-invalid')
      expect(trigger).toHaveTextContent('5')
    })

    it('does not mark a placeholder combo widget invalid before its real options load', () => {
      // A combo widget whose options have not loaded yet has
      // `options: {}` (no `values` key at all). A value that will be a
      // legitimate option once they arrive should not flash the invalid
      // ring in the meantime.
      renderComponent(createWidget(undefined), 'sdxl.safetensors')

      const trigger = screen.getByTestId('widget-select-default-trigger')
      expect(trigger).not.toHaveAttribute('aria-invalid')
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
