import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { zIndexManager } from '@/utils/zIndexManager'

import ImperativePopover from './ImperativePopover.vue'

let openModal: HTMLElement | undefined

function renderPopover(withOutside = false) {
  render({
    components: { ImperativePopover },
    data: () => ({ withOutside }),
    template: `
        <button @click="$refs.popover.toggle($event)">Open</button>
        <button v-if="withOutside">Outside</button>
        <ImperativePopover ref="popover"><button>Content</button></ImperativePopover>
      `
  })
}

afterEach(() => {
  if (openModal) {
    zIndexManager.clear(openModal)
    openModal = undefined
  }
})

describe('ImperativePopover', () => {
  it('does not listen for viewport changes while closed', async () => {
    const listen = vi.spyOn(window, 'addEventListener')
    renderPopover()
    await nextTick()

    expect(
      listen.mock.calls.filter(([type]) => ['scroll', 'resize'].includes(type))
    ).toEqual([])
  })

  it('opens at its target and dismisses with Escape', async () => {
    renderPopover()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await fireEvent['click'](screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Content')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('returns focus after an imperative close', async () => {
    const popover = ref<InstanceType<typeof ImperativePopover>>()
    render(
      defineComponent({
        components: { ImperativePopover },
        setup: () => ({ popover }),
        template: `
          <button @click="popover.show($event)">Open</button>
          <ImperativePopover ref="popover"><button>Content</button></ImperativePopover>
        `
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Open' })

    await user.click(trigger)
    expect(await screen.findByRole('dialog')).toBeVisible()
    popover.value?.hide()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(trigger).toHaveFocus()
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

  it('stays open after outside interaction when not dismissable', async () => {
    render({
      components: { ImperativePopover },
      template: `
        <button @click="$refs.popover.show($event)">Open</button>
        <button>Outside</button>
        <ImperativePopover ref="popover" :dismissable="false">
          <button>Content</button>
        </ImperativePopover>
      `
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Outside' }))

    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('keeps focus outside when focus dismisses it', async () => {
    renderPopover(true)
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const outside = screen.getByRole('button', {
      name: 'Outside',
      hidden: true
    })

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toBeVisible()
    outside.focus()

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(outside).toHaveFocus()
  })

  it('does not move focus into content when opened by hover', async () => {
    const popover = ref<InstanceType<typeof ImperativePopover>>()
    render(
      defineComponent({
        components: { ImperativePopover },
        setup: () => ({ popover }),
        template: `
          <input aria-label="Editing" />
          <button @mouseenter="popover.show($event)">Open</button>
          <ImperativePopover ref="popover"><button>Content</button></ImperativePopover>
        `
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const input = screen.getByRole('textbox', { name: 'Editing' })
    input.focus()

    await user.hover(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toBeVisible()
    await nextTick()

    expect(input).toHaveFocus()
  })

  it('opens above a registered modal', async () => {
    openModal = document.createElement('div')
    zIndexManager.set('modal', openModal, 3702)
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
      components: { ImperativePopover },
      template: `
        <button @click="$refs.popover.toggle($event)">Open</button>
        <ImperativePopover ref="popover"><div>Content</div></ImperativePopover>
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
    const popover = ref<InstanceType<typeof ImperativePopover>>()
    render(
      defineComponent({
        components: { ImperativePopover },
        setup: () => ({ popover }),
        template: `
          <button>Open</button>
          <ImperativePopover ref="popover">Popover content</ImperativePopover>
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
    const popover = ref<InstanceType<typeof ImperativePopover>>()
    render(
      defineComponent({
        components: { ImperativePopover },
        setup: () => ({ popover }),
        template: `
          <div data-testid="scroller">
            <button>Open</button>
          </div>
          <ImperativePopover ref="popover">Popover content</ImperativePopover>
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
