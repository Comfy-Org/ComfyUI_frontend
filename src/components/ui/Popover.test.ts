import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
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
  it.for([
    { name: 'Escape', dismiss: (user: UserEvent) => user.keyboard('{Escape}') },
    {
      name: 'Close',
      dismiss: (user: UserEvent) =>
        user.click(screen.getByRole('button', { name: 'Close' }))
    }
  ])('restores trigger focus after $name', async ({ dismiss }) => {
    const user = renderPopover()
    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    expect(await screen.findByRole('dialog')).toBeVisible()
    await dismiss(user)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('keeps focus on an outside button when dismissed there', async () => {
    const user = renderPopover()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toBeVisible()
    const outside = screen.getByRole('button', { name: 'Outside' })
    await user.click(outside)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(outside).toHaveFocus()
  })

  it.for([
    {
      name: 'ancestor',
      type: 'scroll',
      target: () => screen.getByTestId('ancestor')
    },
    { name: 'document', type: 'scroll', target: () => document },
    { name: 'window', type: 'scroll', target: () => window },
    { name: 'resize', type: 'resize', target: () => window }
  ])(
    'ignores content scrolling but dismisses on $name movement',
    async ({ type, target }) => {
      const user = renderPopover()
      await user.click(screen.getByRole('button', { name: 'Open' }))
      expect(await screen.findByRole('dialog')).toBeVisible()
      await fireEvent.scroll(screen.getByTestId('content'))
      expect(screen.getByRole('dialog')).toBeVisible()

      await fireEvent(target(), new Event(type))

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
  )
})
