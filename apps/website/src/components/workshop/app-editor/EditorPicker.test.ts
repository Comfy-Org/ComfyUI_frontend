import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import EditorPicker from './EditorPicker.vue'

const Harness = defineComponent({
  setup() {
    const open = ref(false)
    return () => [
      h(
        'button',
        {
          type: 'button',
          'aria-haspopup': 'dialog',
          'aria-expanded': open.value,
          onClick: () => (open.value = !open.value)
        },
        'Scene'
      ),
      open.value &&
        h(
          EditorPicker,
          {
            title: 'Pick a scene',
            closeLabel: 'Close',
            onClose: () => (open.value = false)
          },
          () => h('button', { type: 'button' }, 'Yacht')
        )
    ]
  }
})

async function openPicker() {
  render(Harness)
  await userEvent.click(screen.getByRole('button', { name: 'Scene' }))
  return screen.getByRole('dialog', { name: 'Pick a scene' })
}

describe('EditorPicker', () => {
  it('shows its grid in a named dialog and focuses the first choice', async () => {
    const dialog = await openPicker()

    const choice = screen.getByRole('button', { name: 'Yacht' })
    expect(dialog).toContainElement(choice)
    expect(choice).toHaveFocus()
  })

  it.for(['the close button', 'Escape'])('closes with %s', async (way) => {
    await openPicker()

    if (way === 'Escape') await userEvent.keyboard('{Escape}')
    else await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
