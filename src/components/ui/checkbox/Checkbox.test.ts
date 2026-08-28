import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import Checkbox from './Checkbox.vue'

function renderHarness(disabled = false) {
  const Harness = defineComponent({
    components: { Checkbox },
    setup() {
      return { checked: ref(false), disabled: ref(disabled) }
    },
    template:
      '<Checkbox v-model="checked" :disabled="disabled" aria-label="Select node" />'
  })
  render(Harness)
  return screen.getByRole('checkbox', { name: 'Select node' })
}

describe('Checkbox', () => {
  it('updates its checked state when activated', async () => {
    const checkbox = renderHarness()

    expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('toggles with Space while focused', async () => {
    const checkbox = renderHarness()

    await userEvent.tab()
    expect(checkbox).toHaveFocus()

    await userEvent.keyboard(' ')
    expect(checkbox).toBeChecked()

    await userEvent.keyboard(' ')
    expect(checkbox).not.toBeChecked()
  })

  it('blocks interaction only while disabled', async () => {
    const disabledCheckbox = renderHarness(true)
    await userEvent.click(disabledCheckbox)
    expect(disabledCheckbox).not.toBeChecked()
    cleanup()

    const enabledCheckbox = renderHarness()
    await userEvent.click(enabledCheckbox)
    expect(enabledCheckbox).toBeChecked()
  })

  it('passes root-level attributes through to the control', () => {
    render(Checkbox, { attrs: { 'aria-label': 'Pass through' } })

    expect(
      screen.getByRole('checkbox', { name: 'Pass through' })
    ).toBeInTheDocument()
  })

  it('surfaces update emits to controlled consumers', async () => {
    const onUpdate = vi.fn()
    render(Checkbox, {
      props: { modelValue: false, 'onUpdate:modelValue': onUpdate },
      attrs: { 'aria-label': 'Controlled' }
    })

    await userEvent.click(screen.getByRole('checkbox', { name: 'Controlled' }))

    expect(onUpdate).toHaveBeenCalledWith(true)
  })

  it('styles every surface with semantic tokens, never raw palette classes', () => {
    const checkbox = renderHarness()
    const classes = checkbox.getAttribute('class') ?? ''

    expect(classes).toContain('border-border-default')
    expect(classes).toContain('data-[state=checked]:border-primary-background')
    expect(classes).toContain('data-[state=checked]:bg-primary-background')
    expect(classes).not.toMatch(/\b(?:smoke|ink|plum|zinc|gray|slate)-\d/)
  })

  it('merges custom classes without clobbering the base styling', () => {
    render(Checkbox, {
      props: { class: 'size-4' },
      attrs: { 'aria-label': 'Merged' }
    })
    const checkbox = screen.getByRole('checkbox', { name: 'Merged' })

    expect(checkbox.classList.contains('size-4')).toBe(true)
    expect(checkbox.classList.contains('size-5')).toBe(false)
    expect(checkbox.classList.contains('rounded-sm')).toBe(true)
  })
})
