import { ZIndex } from '@primeuix/utils/zindex'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import PopoverOverlay from './PopoverOverlay.vue'

let openModal: HTMLElement | undefined

function renderPopover(withOutside = false) {
  render({
    components: { PopoverOverlay },
    data: () => ({ withOutside }),
    template: `
        <button @click="$refs.popover.toggle($event)">Open</button>
        <button v-if="withOutside">Outside</button>
        <PopoverOverlay ref="popover"><button>Content</button></PopoverOverlay>
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

  it('stays open when the content has nothing tabbable', async () => {
    const focus = HTMLElement.prototype.focus
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(
      function (this: HTMLElement) {
        if (
          this.matches(
            'a[href], button, input, select, textarea, [tabindex], [contenteditable]'
          )
        ) {
          focus.call(this)
        }
      }
    )
    render({
      components: { PopoverOverlay },
      template: `
        <button @click="$refs.popover.toggle($event)">Open</button>
        <PopoverOverlay ref="popover"><div>Content</div></PopoverOverlay>
      `
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('dialog')
    await nextTick()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('does not open when hidden before the queued show completes', async () => {
    const popover = ref<InstanceType<typeof PopoverOverlay>>()
    render(
      defineComponent({
        components: { PopoverOverlay },
        setup: () => ({ popover }),
        template: `
          <button>Open</button>
          <PopoverOverlay ref="popover">Popover content</PopoverOverlay>
        `
      })
    )
    const trigger = screen.getByRole('button', { name: 'Open' })

    popover.value?.show(new Event('show'), trigger)
    popover.value?.hide()
    await nextTick()

    expect(popover.value?.open).toBe(false)
    expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
  })

  it('closes when an anchor ancestor scrolls', async () => {
    const popover = ref<InstanceType<typeof PopoverOverlay>>()
    render(
      defineComponent({
        components: { PopoverOverlay },
        setup: () => ({ popover }),
        template: `
          <div data-testid="scroller">
            <button>Open</button>
          </div>
          <PopoverOverlay ref="popover">Popover content</PopoverOverlay>
        `
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Open' })

    await user.click(trigger)
    popover.value?.show(new Event('show'), trigger)
    expect(await screen.findByText('Popover content')).toBeVisible()

    await fireEvent.scroll(screen.getByTestId('scroller'))

    await waitFor(() =>
      expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
    )
  })

  it.for([
    { name: 'document', target: document },
    { name: 'window', target: window }
  ])('closes on $name scroll', async ({ target }) => {
    renderPopover()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toBeVisible()

    target.dispatchEvent(new Event('scroll'))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })
})
