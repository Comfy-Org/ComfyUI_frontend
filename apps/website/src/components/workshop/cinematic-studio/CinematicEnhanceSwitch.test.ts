import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'

import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicEnhanceSwitch from './CinematicEnhanceSwitch.vue'

describe('CinematicEnhanceSwitch', () => {
  it('toggles the AI prompt and keeps its hint off the page until hover', async () => {
    const enhance = ref(true)
    render({
      setup: () => () =>
        h(CinematicEnhanceSwitch, {
          modelValue: enhance.value,
          'onUpdate:modelValue': (next: boolean) => {
            enhance.value = next
          }
        })
    })
    const user = userEvent.setup()
    const toggle = screen.getByRole('switch', {
      name: tc('cinematic.scene.enhance')
    })

    expect(toggle).toBeChecked()
    expect(screen.queryByText(tc('cinematic.scene.enhanceHint'))).toBeNull()

    await user.click(toggle)
    expect(enhance.value).toBe(false)
  })
})
