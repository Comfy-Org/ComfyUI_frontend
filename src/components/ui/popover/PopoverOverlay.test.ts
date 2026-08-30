import { ZIndex } from '@primeuix/utils/zindex'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import PopoverOverlay from './PopoverOverlay.vue'

let openModal: HTMLElement | undefined

function renderPopover(withOutside = false) {
  render({
    components: { PopoverOverlay },
    data: () => ({ withOutside }),
    template: `
        <button @click="$refs.popover.toggle($event)">Open</button>
        <button v-if="withOutside">Outside</button>
        <PopoverOverlay ref="popover"><div>Content</div></PopoverOverlay>
      `
  })
}

afterEach(() => {
  if (openModal) {
    ZIndex.clear(openModal)
    openModal = undefined
  }
})

describe('PopoverOverlay', () => {
  it('opens at its target and dismisses with Escape', async () => {
    renderPopover()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await fireEvent['click'](screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Content')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('dismisses on an outside press', async () => {
    renderPopover(true)
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await fireEvent['click'](screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Content')
    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('button', { name: 'Outside', hidden: true })
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens above a registered modal', async () => {
    openModal = document.createElement('div')
    ZIndex.set('modal', openModal, 3702)
    const dialogZIndex = Number(openModal.style.zIndex)
    renderPopover()

    await fireEvent['click'](screen.getByRole('button', { name: 'Open' }))
    const content = await screen.findByRole('dialog')
    expect(Number(content.style.zIndex)).toBeGreaterThan(dialogZIndex)
  })
})
