import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished } from 'vitest'
import { defineComponent, ref } from 'vue'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'

import Tooltip from './Tooltip.vue'
import TooltipContent from './TooltipContent.vue'
import TooltipProvider from './TooltipProvider.vue'
import TooltipTrigger from './TooltipTrigger.vue'

const TooltipHarness = defineComponent({
  components: { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger },
  directives: { RekaZIndex: vRekaZIndex },
  props: {
    disabled: { type: Boolean, default: false },
    openOnClick: { type: Boolean, default: false }
  },
  setup() {
    return { dialogs: ref(0) }
  },
  template: `
    <TooltipProvider :delay-duration="0">
      <Tooltip :disabled :open-on-click>
        <TooltipTrigger as-child>
          <button>Trigger</button>
        </TooltipTrigger>
        <TooltipContent>Helpful text</TooltipContent>
      </Tooltip>
      <button @click="dialogs++">Open dialog</button>
      <div v-for="n in dialogs" :key="n" v-reka-z-index data-testid="dialog" />
    </TooltipProvider>
  `
})

describe('Tooltip', () => {
  it('opens on keyboard focus and describes its trigger', async () => {
    const user = userEvent.setup()
    render(TooltipHarness)

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
    expect(
      screen.getByRole('button', { name: 'Trigger' })
    ).toHaveAccessibleDescription('Helpful text')
  })

  it('opens on hover', async () => {
    const user = userEvent.setup()
    render(TooltipHarness)

    await user.hover(screen.getByRole('button', { name: 'Trigger' }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
  })

  it('opens on hover when the trigger content stops pointer moves', async () => {
    const user = userEvent.setup()
    render({
      components: { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger },
      template: `
        <TooltipProvider :delay-duration="0">
          <Tooltip>
            <TooltipTrigger as-child>
              <div><button @pointermove.stop>Widget control</button></div>
            </TooltipTrigger>
            <TooltipContent>Widget value</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      `
    })

    await user.hover(screen.getByRole('button', { name: 'Widget control' }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Widget value')
  })

  it('dismisses with Escape', async () => {
    const user = userEvent.setup()
    render(TooltipHarness)

    await user.tab()
    await screen.findByRole('tooltip')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('dismisses with Escape even when an app shortcut claims the key', async () => {
    const claimEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault()
    }
    window.addEventListener('keydown', claimEscape)
    onTestFinished(() => window.removeEventListener('keydown', claimEscape))
    const user = userEvent.setup()
    render(TooltipHarness)

    await user.tab()
    await screen.findByRole('tooltip')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('stays closed while disabled', async () => {
    const user = userEvent.setup()
    render(TooltipHarness, { props: { disabled: true } })

    await user.tab()

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveFocus()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes when it becomes disabled while open', async () => {
    const user = userEvent.setup()
    const { rerender } = render(TooltipHarness)

    await user.tab()
    await screen.findByRole('tooltip')
    await rerender({ disabled: true })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes when the wheel scrolls over its trigger', async () => {
    const user = userEvent.setup()
    render(TooltipHarness)
    const trigger = screen.getByRole('button', { name: 'Trigger' })

    await user.hover(trigger)
    await screen.findByRole('tooltip')
    await fireEvent.wheel(trigger)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it.for([
    { openOnClick: true, expected: 'open' },
    { openOnClick: false, expected: 'closed' }
  ])(
    'is $expected after a tap when openOnClick is $openOnClick',
    async ({ openOnClick, expected }) => {
      const user = userEvent.setup()
      render(TooltipHarness, { props: { openOnClick } })
      const trigger = screen.getByRole('button', { name: 'Trigger' })

      await user.pointer({ keys: '[TouchA]', target: trigger })

      expect(trigger).toHaveAttribute(
        'data-state',
        expect.stringMatching(expected)
      )
    }
  )

  it('stays open after a mouse click when openOnClick is set', async () => {
    const user = userEvent.setup()
    render(TooltipHarness, { props: { openOnClick: true } })

    await user.click(screen.getByRole('button', { name: 'Trigger' }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
  })

  it('portals its content out of the trigger subtree', async () => {
    const user = userEvent.setup()
    const { container } = render(TooltipHarness)

    await user.tab()

    const tooltip = await screen.findByRole('tooltip')
    expect(container).not.toContainElement(tooltip)
    expect(document.body).toContainElement(tooltip)
  })

  it('lifts above the topmost dialog each time it opens', async () => {
    const user = userEvent.setup()
    render(TooltipHarness)
    const trigger = screen.getByRole('button', { name: 'Trigger' })
    const openDialog = screen.getByRole('button', { name: 'Open dialog' })
    const contentZIndex = async () =>
      Number((await screen.findByTestId('tooltip-content')).style.zIndex)
    const topDialogZIndex = () =>
      Math.max(
        ...screen.getAllByTestId('dialog').map((el) => Number(el.style.zIndex))
      )

    await user.click(openDialog)
    await user.hover(trigger)
    expect(await contentZIndex()).toBe(topDialogZIndex() + 1)

    await user.click(openDialog)
    await user.hover(trigger)
    expect(await contentZIndex()).toBe(topDialogZIndex() + 1)
  })
})
