import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import ToggleGroup from './ToggleGroup.vue'
import ToggleGroupItem from './ToggleGroupItem.vue'

describe('ToggleGroup', () => {
  it('keeps a required single selection when clicked again', async () => {
    const user = userEvent.setup()
    const Harness = defineComponent({
      components: { ToggleGroup, ToggleGroupItem },
      setup: () => ({ value: ref('one') }),
      template: `
        <ToggleGroup v-model="value" type="single" required>
          <ToggleGroupItem value="one">One</ToggleGroupItem>
          <ToggleGroupItem value="two">Two</ToggleGroupItem>
        </ToggleGroup>`
    })

    render(Harness)
    const selected = screen.getByRole('button', { name: 'One' })

    await user.click(selected)

    expect(selected).toHaveAttribute('data-state', 'on')
  })
})
