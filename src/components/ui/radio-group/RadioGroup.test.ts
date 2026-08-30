import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import RadioGroup from './RadioGroup.vue'
import RadioGroupItem from './RadioGroupItem.vue'

const Harness = defineComponent({
  components: { RadioGroup, RadioGroupItem },
  setup() {
    const value = ref('first')
    return { value }
  },
  template: `
    <RadioGroup v-model="value" aria-label="Choice">
      <RadioGroupItem value="first" aria-label="First" />
      <RadioGroupItem value="second" aria-label="Second" />
    </RadioGroup>
  `
})

describe('RadioGroup', () => {
  it('updates selection through keyboard activation', async () => {
    const user = userEvent.setup()
    render(Harness)

    const first = screen.getByRole('radio', { name: 'First' })
    const second = screen.getByRole('radio', { name: 'Second' })
    expect(first).toBeChecked()
    expect(second).not.toBeChecked()

    second.focus()
    await user.keyboard('[Space]')

    expect(second).toBeChecked()
    expect(second).toHaveFocus()
  })

  it('prevents interaction while disabled', async () => {
    const user = userEvent.setup()
    render(Harness, { props: {}, attrs: { disabled: true } })

    const second = screen.getByRole('radio', { name: 'Second' })
    await user.click(second)

    expect(second).not.toBeChecked()
  })
})
