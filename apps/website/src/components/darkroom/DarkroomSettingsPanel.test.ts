import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { DEFAULT_DARKROOM_SETTINGS } from '@/lib/darkroom/vocabulary'

import DarkroomSettingsPanel from './DarkroomSettingsPanel.vue'

function mount(maxRuns: number) {
  return render(
    defineComponent({
      setup: () => () =>
        h(DarkroomSettingsPanel, {
          modelValue: { ...DEFAULT_DARKROOM_SETTINGS },
          maxRuns
        })
    })
  )
}

describe('DarkroomSettingsPanel', () => {
  it('offers as many images as the account may run at once', () => {
    mount(3)
    const images = screen.getByRole('group', { name: 'Images' })
    expect(within(images).getAllByRole('button')).toHaveLength(3)
  })

  it('shows an account limited to one image no way to ask for more', () => {
    mount(1)
    expect(screen.queryByRole('group', { name: 'Images' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Resolution' })).toBeTruthy()
  })
})
