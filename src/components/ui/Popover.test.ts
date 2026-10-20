import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import Popover from './Popover.vue'

function renderPopover() {
  render({
    components: { Popover },
    template: `
      <div data-testid="ancestor">
        <Popover>
          <template #button><button>Open</button></template>
          <template #default="{ close }">
            <div data-testid="content"><button @click="close">Close</button></div>
          </template>
        </Popover>
      </div>
      <button>Outside</button>
    `
  })
  return userEvent.setup({ pointerEventsCheck: 0 })
}

describe('Popover', () => {
  it.for(['Escape', 'Close'])(
    'restores trigger focus after %s',
    async (action) => {
      const user = renderPopover()
      const trigger = screen.getByRole('button', { name: 'Open' })
      await user.click(trigger)
      expect(await screen.findByRole('dialog')).toBeVisible()
      if (action === 'Escape') await user.keyboard('{Escape}')
      else await user.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(trigger).toHaveFocus()
    }
  )

  it('keeps focus on an outside button when dismissed there', async () => {
    const user = renderPopover()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toBeVisible()
    const outside = screen.getByRole('button', { name: 'Outside' })
    await user.click(outside)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(outside).toHaveFocus()
  })

  it.for(['ancestor', 'document', 'window', 'resize'])(
    'ignores content scrolling but dismisses on %s movement',
    async (target) => {
      const user = renderPopover()
      await user.click(screen.getByRole('button', { name: 'Open' }))
      expect(await screen.findByRole('dialog')).toBeVisible()
      await fireEvent.scroll(screen.getByTestId('content'))
      expect(screen.getByRole('dialog')).toBeVisible()

      if (target === 'ancestor')
        await fireEvent.scroll(screen.getByTestId('ancestor'))
      else if (target === 'document')
        document.dispatchEvent(new Event('scroll'))
      else
        window.dispatchEvent(
          new Event(target === 'resize' ? 'resize' : 'scroll')
        )

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
  )
})
