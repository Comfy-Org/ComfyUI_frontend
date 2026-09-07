import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, ref } from 'vue'
import { describe, expect, it } from 'vitest'

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
})
