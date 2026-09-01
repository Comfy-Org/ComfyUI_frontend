import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import Checkbox from './Checkbox.vue'

describe('Checkbox', () => {
  it('updates its checked state when activated', async () => {
    const Harness = defineComponent({
      components: { Checkbox },
      setup() {
        return { checked: ref(false) }
      },
      template: '<Checkbox v-model="checked" aria-label="Select node" />'
    })
    render(Harness)
    const checkbox = screen.getByRole('checkbox', { name: 'Select node' })

    expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('does not update when disabled', async () => {
    render(Checkbox, {
      props: {
        modelValue: false,
        disabled: true
      },
      attrs: { 'aria-label': 'Select node' }
    })
    const checkbox = screen.getByRole('checkbox', { name: 'Select node' })

    await userEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('toggles with Space while focused', async () => {
    const Harness = defineComponent({
      components: { Checkbox },
      setup() {
        return { checked: ref(false) }
      },
      template: '<Checkbox v-model="checked" aria-label="Keyboard checkbox" />'
    })
    render(Harness)
    const checkbox = screen.getByRole('checkbox', {
      name: 'Keyboard checkbox'
    })

    await userEvent.tab()
    expect(checkbox).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(checkbox).toBeChecked()
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
})
