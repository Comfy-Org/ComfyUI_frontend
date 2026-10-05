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
        <ToggleGroup v-model="value" type="single" :allow-empty="false">
          <ToggleGroupItem value="one">One</ToggleGroupItem>
          <ToggleGroupItem value="two">Two</ToggleGroupItem>
        </ToggleGroup>`
    })

    render(Harness)
    const first = screen.getByRole('button', { name: 'One' })
    const second = screen.getByRole('button', { name: 'Two' })

    await user.click(second)
    expect(first).toHaveAttribute('aria-pressed', 'false')
    expect(second).toHaveAttribute('aria-pressed', 'true')

    await user.click(second)

    expect(second).toHaveAttribute('aria-pressed', 'true')
  })
})
