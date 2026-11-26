import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { DialogPortal, ToolbarButton, ToolbarRoot } from 'reka-ui'

import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { appTooltipProviderDefaults } from '@comfyorg/design-system/lib/tooltip/tooltipConfig'

const TooltipHarness = defineComponent({
  components: {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
    DialogPortal
  },
  props: {
    delayDuration: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
    openOnClick: { type: Boolean, default: false }
  },
  setup() {
    return { dialogs: ref(0) }
  },
  template: `
    <TooltipProvider :delay-duration>
      <Tooltip :disabled :open-on-click>
        <TooltipTrigger as-child>
          <button>Trigger</button>
        </TooltipTrigger>
        <TooltipContent>Helpful text</TooltipContent>
      </Tooltip>
      <button @click="dialogs++">Open dialog</button>
      <DialogPortal v-for="n in dialogs" :key="n"><div data-testid="dialog" class="fixed z-overlay" /></DialogPortal>
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

  it('still describes keyboard focus after a hover hint was cancelled', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(TooltipHarness, { props: { delayDuration: 2500 } })
    const trigger = screen.getByRole('button', { name: 'Trigger' })

    await user.hover(trigger)
    await fireEvent.wheel(trigger)
    await user.tab()

    expect(trigger).toHaveAccessibleDescription('Helpful text')
  })

  it('describes arrow-key focus after a wheel-cancelled hover', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render({
      components: {
        ToolbarRoot,
        ToolbarButton,
        Tooltip,
        TooltipContent,
        TooltipProvider,
        TooltipTrigger
      },
      template: `
        <TooltipProvider :delay-duration="2500">
          <ToolbarRoot>
            <ToolbarButton>Previous</ToolbarButton>
            <Tooltip>
              <TooltipTrigger as-child>
                <ToolbarButton>Trigger</ToolbarButton>
              </TooltipTrigger>
              <TooltipContent>Helpful text</TooltipContent>
            </Tooltip>
          </ToolbarRoot>
        </TooltipProvider>
      `
    })
    const trigger = screen.getByRole('button', { name: 'Trigger' })

    await user.tab()
    await user.hover(trigger)
    await fireEvent.wheel(trigger)
    await user.keyboard('{ArrowRight}')

    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAccessibleDescription('Helpful text')
  })

  it.for([
    { skipDelayDuration: 0, earlyHint: null },
    { skipDelayDuration: 1000, earlyHint: 'Second hint' }
  ])(
    'respects a skip-delay window of $skipDelayDuration ms',
    async ({ skipDelayDuration, earlyHint }) => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render({
        components: {
          Tooltip,
          TooltipContent,
          TooltipProvider,
          TooltipTrigger
        },
        setup: () => ({ skipDelayDuration }),
        template: `
        <TooltipProvider :skip-delay-duration>
          <Tooltip>
            <TooltipTrigger>First</TooltipTrigger>
            <TooltipContent>First hint</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>Second</TooltipTrigger>
            <TooltipContent>Second hint</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      `
      })

      await user.hover(screen.getByRole('button', { name: 'First' }))
      await vi.advanceTimersByTimeAsync(
        appTooltipProviderDefaults.delayDuration - 1
      )
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(1)
      expect(screen.getByRole('tooltip')).toHaveTextContent('First hint')

      await user.hover(screen.getByRole('button', { name: 'Second' }))
      expect(screen.queryByRole('tooltip')?.textContent ?? null).toBe(earlyHint)
      await vi.advanceTimersByTimeAsync(
        appTooltipProviderDefaults.delayDuration - 1
      )
      expect(screen.queryByRole('tooltip')?.textContent ?? null).toBe(earlyHint)
      await vi.advanceTimersByTimeAsync(1)
      expect(screen.getByRole('tooltip')).toHaveTextContent('Second hint')
    }
  )

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

  it('stays closed when the pointer enters with a button held', async () => {
    const user = userEvent.setup()
    render(TooltipHarness)

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByRole('button', { name: 'Open dialog' })
      },
      { target: screen.getByRole('button', { name: 'Trigger' }) }
    ])
    await vi.advanceTimersByTimeAsync(50)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('cancels the open delay when the wheel scrolls', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(TooltipHarness, { props: { delayDuration: 300 } })
    const trigger = screen.getByRole('button', { name: 'Trigger' })

    await user.hover(trigger)
    await fireEvent.wheel(trigger)
    await vi.advanceTimersByTimeAsync(400)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('does not reopen while interacting with a widget that stops pointer events', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render({
      components: { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger },
      template: `
        <TooltipProvider :delay-duration="2500">
          <Tooltip>
            <TooltipTrigger as-child>
              <div><input aria-label="Widget value" @pointerdown.stop @pointermove.stop /></div>
            </TooltipTrigger>
            <TooltipContent>Widget hint</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      `
    })
    const widget = screen.getByRole('textbox', { name: 'Widget value' })

    await user.hover(widget)
    await vi.advanceTimersByTimeAsync(2000)
    await user.pointer({ keys: '[MouseLeft>]', target: widget })
    await vi.advanceTimersByTimeAsync(3000)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.pointer({ keys: '[/MouseLeft]', target: widget })
    await user.type(widget, '42')
    await vi.advanceTimersByTimeAsync(3000)
    expect(widget).toHaveValue('42')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('requires a fresh hover after dragging across a tooltip', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(TooltipHarness, { props: { delayDuration: 2500 } })
    const trigger = screen.getByRole('button', { name: 'Trigger' })

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByRole('button', { name: 'Open dialog' })
      },
      { target: trigger },
      { keys: '[/MouseLeft]', target: trigger }
    ])
    await vi.advanceTimersByTimeAsync(3000)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.unhover(trigger)
    await user.hover(trigger)
    await vi.advanceTimersByTimeAsync(2499)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful text')
  })

  it('opens only after a stationary touch long press and closes on release', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(TooltipHarness)
    const trigger = screen.getByRole('button', { name: 'Trigger' })

    await user.pointer({ keys: '[TouchA>]', target: trigger })
    await vi.advanceTimersByTimeAsync(
      appTooltipProviderDefaults.delayDuration - 1
    )
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful text')

    await user.pointer({ keys: '[/TouchA]', target: trigger })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it.for(['pointermove', 'pointercancel'] as const)(
    'cancels a touch long press on %s',
    async (event) => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(TooltipHarness)
      const trigger = screen.getByRole('button', { name: 'Trigger' })

      await user.pointer({ keys: '[TouchA>]', target: trigger })
      await fireEvent(
        trigger,
        new PointerEvent(event, {
          bubbles: true,
          pointerType: 'touch',
          clientX: 30
        })
      )
      await vi.advanceTimersByTimeAsync(3000)

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    }
  )

  it('keeps the open delay for the next tooltip after an open one unmounts', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { rerender } = render(
      {
        components: {
          Tooltip,
          TooltipContent,
          TooltipProvider,
          TooltipTrigger
        },
        props: { showFirst: { type: Boolean, default: true } },
        template: `
          <TooltipProvider :delay-duration="300">
            <Tooltip v-if="showFirst">
              <TooltipTrigger as-child><button>First</button></TooltipTrigger>
              <TooltipContent>First tip</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child><button>Second</button></TooltipTrigger>
              <TooltipContent>Second tip</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        `
      },
      { props: { showFirst: true } }
    )

    await user.hover(screen.getByRole('button', { name: 'First' }))
    await vi.advanceTimersByTimeAsync(400)
    await screen.findByRole('tooltip')
    await rerender({ showFirst: false })
    await vi.advanceTimersByTimeAsync(400)
    await user.hover(screen.getByRole('button', { name: 'Second' }))

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(400)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Second tip')
  })

  it('closes when it becomes disabled while open', async () => {
    const user = userEvent.setup()
    const { rerender } = render(TooltipHarness)

    await user.tab()
    await screen.findByRole('tooltip')
    await rerender({ disabled: true })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes when the pointer leaves the trigger', async () => {
    const user = userEvent.setup()
    render(TooltipHarness)
    const trigger = screen.getByRole('button', { name: 'Trigger' })

    await user.hover(trigger)
    await screen.findByRole('tooltip')
    await user.unhover(trigger)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes when the wheel scrolls', async () => {
    const user = userEvent.setup()
    render(TooltipHarness)
    const trigger = screen.getByRole('button', { name: 'Trigger' })

    await user.hover(trigger)
    await screen.findByRole('tooltip')
    await fireEvent.wheel(trigger)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it.for([
    { openOnClick: true, tooltips: ['Helpful text'] },
    { openOnClick: false, tooltips: [] }
  ])(
    'renders the tooltip after a tap only when openOnClick is set (openOnClick: $openOnClick)',
    async ({ openOnClick, tooltips }) => {
      const user = userEvent.setup()
      render(TooltipHarness, { props: { openOnClick } })

      await user.pointer({
        keys: '[TouchA]',
        target: screen.getByRole('button', { name: 'Trigger' })
      })

      expect(
        screen.queryAllByRole('tooltip').map((tooltip) => tooltip.textContent)
      ).toEqual(tooltips)
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
    await user.click(openDialog)
    await user.hover(trigger)
    const firstContent = await screen.findByTestId('tooltip-content')
    expect(
      screen.getByTestId('dialog').compareDocumentPosition(firstContent)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    await user.click(openDialog)
    await user.hover(trigger)
    const reopenedContent = await screen.findByTestId('tooltip-content')
    expect(
      screen
        .getAllByTestId('dialog')
        .map((dialog) => dialog.compareDocumentPosition(reopenedContent))
    ).toEqual([
      Node.DOCUMENT_POSITION_FOLLOWING,
      Node.DOCUMENT_POSITION_FOLLOWING
    ])
  })
})
