import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ColorCustomizationSelector from './ColorCustomizationSelector.vue'

describe('ColorCustomizationSelector', () => {
  const colorOptions = [
    { name: 'Blue', value: '#0d6efd' },
    { name: 'Green', value: '#28a745' }
  ]

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { color: { hex: 'Hex', rgba: 'RGBA' } } }
  })

  function renderComponent(
    props: Record<string, unknown> = {},
    callbacks: { 'onUpdate:modelValue'?: (value: string | null) => void } = {}
  ) {
    const user = userEvent.setup()

    const result = render(ColorCustomizationSelector, {
      global: {
        plugins: [i18n]
      },
      props: {
        modelValue: null,
        colorOptions,
        ...props,
        ...callbacks
      }
    })

    return { ...result, user }
  }

  function getToggleButtons() {
    return ['Blue', 'Green', '_custom'].map((name) =>
      screen.getByRole('button', { name })
    )
  }

  it('renders predefined color options and custom option', () => {
    renderComponent()
    expect(getToggleButtons()).toHaveLength(colorOptions.length + 1)
  })

  it('initializes with predefined color when provided', async () => {
    renderComponent({ modelValue: '#0d6efd' })
    await nextTick()

    const buttons = getToggleButtons()
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('initializes with custom color when non-predefined color provided', async () => {
    renderComponent({ modelValue: '#123456' })
    await nextTick()

    const buttons = getToggleButtons()
    const customButton = buttons[buttons.length - 1]
    expect(customButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows color picker when custom option is selected', async () => {
    const { container, user } = renderComponent({ modelValue: '#0d6efd' })
    await nextTick()

    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container -- count buttons to detect the ColorPicker popover trigger appearing
    const initialButtonCount = container.querySelectorAll('button').length
    const toggleButtons = getToggleButtons()
    await user.click(toggleButtons[toggleButtons.length - 1])
    await nextTick()

    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container -- count buttons to detect the ColorPicker popover trigger appearing
    const afterButtonCount = container.querySelectorAll('button').length
    expect(afterButtonCount).toBe(initialButtonCount + 1)
  })

  it('emits update when predefined color is selected', async () => {
    const onUpdate = vi.fn()
    const { user } = renderComponent({}, { 'onUpdate:modelValue': onUpdate })

    const buttons = getToggleButtons()
    await user.click(buttons[0])

    expect(onUpdate).toHaveBeenCalledWith('#0d6efd')
  })

  it('emits update when custom color is changed', async () => {
    const onUpdate = vi.fn()
    const { user } = renderComponent({}, { 'onUpdate:modelValue': onUpdate })

    // Custom is already selected by default (modelValue: null)
    // Select Blue first, then switch to custom so onUpdate fires for Blue
    const buttons = getToggleButtons()
    await user.click(buttons[0]) // Select Blue
    expect(onUpdate).toHaveBeenCalledWith('#0d6efd')

    onUpdate.mockClear()
    await user.click(buttons[buttons.length - 1]) // Switch to custom

    // When switching to custom, the custom color value inherits from Blue
    // and the watcher on customColorValue emits the update
    expect(onUpdate).toHaveBeenCalledWith('#0d6efd')
  })

  it('inherits color from previous selection when switching to custom', async () => {
    const onUpdate = vi.fn()
    const { user } = renderComponent({}, { 'onUpdate:modelValue': onUpdate })

    const buttons = getToggleButtons()

    // First select Blue
    await user.click(buttons[0])
    expect(onUpdate).toHaveBeenCalledWith('#0d6efd')

    onUpdate.mockClear()

    // Then switch to custom — inherits the Blue color
    await user.click(buttons[buttons.length - 1])

    // The customColorValue watcher fires with the inherited Blue value
    expect(onUpdate).toHaveBeenCalledWith('#0d6efd')
  })

  it('handles null modelValue correctly', async () => {
    renderComponent({ modelValue: null })
    await nextTick()

    const buttons = getToggleButtons()
    const customButton = buttons[buttons.length - 1]
    expect(customButton).toHaveAttribute('aria-pressed', 'true')
  })
})
