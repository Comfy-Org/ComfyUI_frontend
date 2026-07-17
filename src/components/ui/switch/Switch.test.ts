import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import Switch from './Switch.vue'

function renderSwitch(options: { checked?: boolean; disabled?: boolean } = {}) {
  const Wrapper = defineComponent({
    components: { Switch },
    setup() {
      const checked = ref(options.checked ?? false)
      return { checked, disabled: options.disabled ?? false }
    },
    template: `
      <Switch
        v-model="checked"
        :disabled="disabled"
        aria-label="Test switch"
      />
    `
  })

  return render(Wrapper)
}

describe('Switch', () => {
  it('updates its checked state', async () => {
    const user = userEvent.setup()
    renderSwitch()

    const control = screen.getByRole('switch', { name: 'Test switch' })
    expect(control).not.toBeChecked()

    await user.click(control)

    expect(control).toBeChecked()
  })

  it('does not update while disabled', async () => {
    const user = userEvent.setup()
    renderSwitch({ checked: true, disabled: true })

    const control = screen.getByRole('switch', { name: 'Test switch' })
    expect(control).toBeDisabled()

    await user.click(control)

    expect(control).toBeChecked()
  })
})
