import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import messages from '@/locales/en/main.json'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumber from './WidgetInputNumber.vue'
import WidgetSelectDefault from './WidgetSelectDefault.vue'
import WidgetTextarea from './WidgetTextarea.vue'
import WidgetToggleSwitch from './WidgetToggleSwitch.vue'

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: vi.fn() })
}))

function widgetPlugins() {
  return [
    createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
  ]
}

describe('linked widget presentation', () => {
  it('hides and restores the seed value and its auxiliary control together', async () => {
    const updateControl = vi.fn()
    const onUpdate = vi.fn()
    const widget: SimplifiedWidget<number> = {
      name: 'seed',
      type: 'number',
      value: 42,
      controlWidget: { value: 'randomize', update: updateControl }
    }
    const { rerender } = render(WidgetInputNumber, {
      global: { plugins: widgetPlugins() },
      props: { widget, modelValue: 42, 'onUpdate:modelValue': onUpdate }
    })
    const input = await screen.findByRole('spinbutton')
    const control = screen.getByRole('button', {
      name: messages.widgets.valueControl.randomize
    })

    await rerender({
      widget: {
        ...widget,
        linkedDisplay: 'control',
        options: { disabled: true }
      }
    })
    expect(
      screen.getByRole('img', { name: 'seed: Linked input' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: messages.widgets.valueControl.randomize
      })
    ).not.toBeInTheDocument()
    expect(input).toBeInTheDocument()
    expect(control).toBeInTheDocument()
    expect(input).toHaveValue('42')
    expect(input.matches('[inert], [inert] *')).toBe(true)
    expect(control.matches('[inert], [inert] *')).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()
    expect(updateControl).not.toHaveBeenCalled()

    await rerender({ widget })
    expect(screen.getByRole('spinbutton')).toBe(input)
    expect(input.matches('[inert], [inert] *')).toBe(false)
    expect(
      screen.getByRole('button', {
        name: messages.widgets.valueControl.randomize
      })
    ).toBe(control)
    expect(input).toHaveValue('42')
  })

  it('hides a combo value and restores its selection on disconnect', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const widget: SimplifiedWidget<string | undefined> = {
      name: 'sampler',
      type: 'combo',
      value: 'euler',
      options: { values: ['euler', 'heun'] }
    }
    const { rerender } = render(WidgetSelectDefault, {
      global: { plugins: widgetPlugins() },
      props: { widget, modelValue: 'euler', 'onUpdate:modelValue': onUpdate }
    })
    const trigger = screen.getByRole('combobox', { name: 'sampler' })
    await rerender({
      widget: {
        ...widget,
        linkedDisplay: 'control',
        options: { ...widget.options, disabled: true }
      }
    })
    expect(
      screen.getByRole('img', { name: 'sampler: Linked input' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(trigger).toBeInTheDocument()
    expect(trigger.matches('[inert], [inert] *')).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()

    await rerender({ widget })
    expect(screen.getByRole('combobox', { name: 'sampler' })).toBe(trigger)
    expect(trigger.matches('[inert], [inert] *')).toBe(false)
    expect(trigger).toHaveTextContent('euler')
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'heun' }))
    expect(onUpdate).toHaveBeenLastCalledWith('heun')
  })
  it('preserves the mounted textarea editor and value through display transitions', async () => {
    const user = userEvent.setup()
    const widget: SimplifiedWidget<string> = {
      name: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      value: 'Local draft'
    }
    const onUpdate = vi.fn()
    const { rerender } = render(WidgetTextarea, {
      global: { plugins: widgetPlugins() },
      props: {
        widget,
        modelValue: widget.value,
        'onUpdate:modelValue': onUpdate
      }
    })
    const input = screen.getByRole('textbox')
    await user.click(input)
    expect(input).toHaveFocus()

    await rerender({
      widget: {
        ...widget,
        linkedDisplay: 'expanding',
        options: { disabled: true }
      }
    })
    expect(
      screen.getByRole('img', { name: 'Prompt: Linked input' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Local draft')
    expect(input).toHaveAttribute('inert')
    expect(onUpdate).not.toHaveBeenCalled()

    await rerender({ widget })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBe(input)
    expect(input).not.toHaveAttribute('inert')
    await user.clear(input)
    await user.type(input, 'New draft')
    expect(onUpdate).toHaveBeenLastCalledWith('New draft')
  })

  it('retains the switch state without emitting a value change when linked', async () => {
    const widget: SimplifiedWidget<boolean> = {
      name: 'enabled',
      type: 'boolean',
      value: true
    }
    const onUpdate = vi.fn()
    const { rerender } = render(WidgetToggleSwitch, {
      global: { plugins: widgetPlugins() },
      props: { widget, modelValue: true, 'onUpdate:modelValue': onUpdate }
    })
    const control = screen.getByRole('switch')
    await rerender({
      widget: {
        ...widget,
        linkedDisplay: 'switch',
        options: { disabled: true }
      }
    })
    expect(
      screen.getByRole('img', { name: 'enabled: Linked input' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(control.matches('[inert], [inert] *')).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()
    await rerender({ widget })
    expect(screen.getByRole('switch')).toBe(control)
    expect(control.matches('[inert], [inert] *')).toBe(false)
    expect(control).toBeChecked()
  })
})
