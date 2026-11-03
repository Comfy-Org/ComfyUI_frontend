import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'

function renderPopover() {
  render({
    components: { PopoverContent, PopoverRoot, PopoverTrigger },
    template: `
      <div data-testid="ancestor">
        <PopoverRoot v-slot="{ close }">
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent dismiss-on-viewport-change>
            <div data-testid="content"><button @click="close">Close</button></div>
          </PopoverContent>
        </PopoverRoot>
      </div>
      <button>Outside</button>
    `
  })
  return userEvent.setup({ pointerEventsCheck: 0 })
}

describe('PopoverContent', () => {
  it('reopens after a later overlay in document order', async () => {
    const open = ref(false)
    render({
      components: { PopoverContent, PopoverRoot, PopoverTrigger },
      setup: () => ({ open }),
      template: `
        <PopoverRoot v-model:open="open">
          <PopoverTrigger>Toggle</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </PopoverRoot>
      `
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Toggle' })

    await user.tab()
    expect(trigger).toHaveFocus()
    open.value = true
    expect(await screen.findByRole('dialog')).toBeVisible()
    open.value = false
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })

    const laterDialog = screen.getByTestId('existing-overlay')
    open.value = true

    const reopenedContent = await screen.findByRole('dialog')
    expect(laterDialog.compareDocumentPosition(reopenedContent)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

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
