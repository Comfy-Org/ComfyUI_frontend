import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { ModelTab } from '@/lib/workshop/explorer/model-tabs'
import ModelTabs from './ModelTabs.vue'

function renderTabs(initial: ModelTab = 'all') {
  const selected = ref<ModelTab>(initial)
  render(
    defineComponent({
      setup: () => () =>
        h(ModelTabs, {
          modelValue: selected.value,
          panelId: 'panel',
          'onUpdate:modelValue': (value: ModelTab) => {
            selected.value = value
          }
        })
    })
  )
  return selected
}

describe('ModelTabs', () => {
  it('offers every category as a tab on one list', () => {
    renderTabs()
    const list = screen.getByRole('tablist', { name: 'Model categories' })
    expect(
      screen.getAllByRole('tab').map((tab) => tab.textContent.trim())
    ).toEqual([
      'All',
      'Image',
      'Video',
      'Audio',
      '3D',
      'Edit',
      'Upscale',
      'LLM',
      'Open weights',
      'Partner nodes'
    ])
    for (const tab of screen.getAllByRole('tab')) {
      expect(list).toContainElement(tab)
      expect(tab).toHaveAttribute('aria-controls', 'panel')
    }
  })

  it('marks the chosen tab and keeps only it in the tab order', () => {
    renderTabs('open')
    const open = screen.getByRole('tab', { name: 'Open weights' })
    expect(open).toHaveAttribute('aria-selected', 'true')
    expect(open).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'tabindex',
      '-1'
    )
  })

  it('chooses a tab on click', async () => {
    const selected = renderTabs()
    await userEvent.click(screen.getByRole('tab', { name: 'Video' }))
    expect(selected.value).toBe('video')
  })

  it('moves along the tabs with the arrow keys, wrapping at the ends', async () => {
    const selected = renderTabs()
    const user = userEvent.setup()
    screen.getByRole('tab', { name: 'All' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(selected.value).toBe('image')
    expect(screen.getByRole('tab', { name: 'Image' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(selected.value).toBe('partner')
  })
})
