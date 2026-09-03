import { ZIndex } from '@primeuix/utils/zindex'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Tooltip from './Tooltip.vue'
import { resetTooltipInputModality } from './tooltipInputModality'

const openDialogs: HTMLElement[] = []

afterEach(() => {
  for (const dialog of openDialogs.splice(0)) ZIndex.clear(dialog)
  resetTooltipInputModality()
})

function renderTooltip(
  config: string | { value: string; showDelay?: number } = 'Helpful text',
  side: 'top' | 'right' | 'bottom' | 'left' = 'top'
) {
  return render(Tooltip, {
    props: { config, side },
    slots: { default: '<button>Trigger</button>' }
  })
}

describe('Tooltip', () => {
  it('opens after the configured hover delay', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip({ value: 'Delayed text', showDelay: 300 })

    await user.hover(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(300)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Delayed text')
  })

  it('opens from pointer entry without requiring pointer movement', async () => {
    vi.useFakeTimers()
    renderTooltip({ value: 'Delayed text', showDelay: 300 })

    screen
      .getByRole('button')
      .dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    await vi.advanceTimersByTimeAsync(300)

    expect(screen.getByRole('tooltip')).toHaveTextContent('Delayed text')
  })

  it('opens on keyboard focus and describes its trigger', async () => {
    const user = userEvent.setup()
    renderTooltip()

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
    expect(screen.getByRole('button')).toHaveAccessibleDescription(
      'Helpful text'
    )
  })

  it('does not repeat an aria-label as its accessible description', async () => {
    const user = userEvent.setup()
    render({
      components: { Tooltip },
      template: `
        <Tooltip config="Helpful text" aria-label="Helpful text">
          <button>Trigger</button>
        </Tooltip>
      `
    })

    await user.tab()

    const trigger = screen.getByRole('button')
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
    expect(trigger).toHaveAccessibleName('Helpful text')
    expect(trigger).not.toHaveAccessibleDescription()
  })

  it('keeps distinct tooltip text as its accessible description', async () => {
    const user = userEvent.setup()
    render({
      components: { Tooltip },
      template: `
        <Tooltip config="More context" aria-label="Action">
          <button>Trigger</button>
        </Tooltip>
      `
    })

    await user.tab()

    const trigger = screen.getByRole('button')
    expect(await screen.findByRole('tooltip')).toHaveTextContent('More context')
    expect(trigger).toHaveAccessibleName('Action')
    expect(trigger).toHaveAccessibleDescription('More context')
  })

  it('dismisses a focus-opened tooltip when a touch interaction starts', async () => {
    const user = userEvent.setup()
    renderTooltip()
    const outside = document.createElement('div')
    document.body.append(outside)

    await user.tab()
    await screen.findByRole('tooltip')
    await fireEvent.touchStart(outside)

    await vi.waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
    outside.remove()
  })

  it('cancels a pending hover tooltip when a touch interaction starts', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip({ value: 'Delayed text', showDelay: 300 })
    const outside = document.createElement('div')
    document.body.append(outside)

    await user.hover(screen.getByRole('button'))
    await fireEvent.touchStart(outside)
    await vi.advanceTimersByTimeAsync(300)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    outside.remove()
  })

  it('suppresses hover tooltips that begin immediately after touch', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip({ value: 'Delayed text', showDelay: 300 })
    const outside = document.createElement('div')
    document.body.append(outside)

    await fireEvent.touchStart(outside)
    await user.hover(screen.getByRole('button'))
    await vi.advanceTimersByTimeAsync(300)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    outside.remove()
  })

  it('does not open from focus transferred by a pointer interaction', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip()
    const trigger = screen.getByRole('button')

    await user.click(trigger)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens when mouse hover follows a pointer interaction', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip()
    const trigger = screen.getByRole('button')
    const outside = document.createElement('button')
    document.body.append(outside)

    await user.click(outside)
    await user.hover(trigger)

    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful text')
    outside.remove()
  })

  it('preserves touch suppression while all tooltips are unmounted', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const first = renderTooltip()
    const outside = document.createElement('button')
    document.body.append(outside)

    await fireEvent.touchStart(outside)
    first.unmount()
    renderTooltip()
    const trigger = screen.getByRole('button', { name: 'Trigger' })
    await fireEvent.focus(trigger)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(1000)
    await fireEvent.blur(trigger)
    await fireEvent.focus(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    const pointerMove = new PointerEvent('pointermove', {
      bubbles: true,
      pointerType: 'mouse'
    })
    Object.defineProperty(pointerMove, 'movementX', { value: 10 })
    Object.defineProperty(pointerMove, 'movementY', { value: 0 })
    trigger.dispatchEvent(pointerMove)
    await user.hover(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful text')
    outside.remove()
  })

  it('restores keyboard tooltips after a touch interaction', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip()
    const outside = document.createElement('div')
    document.body.append(outside)

    await fireEvent.touchStart(outside)
    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
    outside.remove()
  })

  it('opens on click without bubbling or duplicating the accessible label', async () => {
    const cardClick = vi.fn()
    const user = userEvent.setup()
    const Card = {
      components: { Tooltip },
      template: `
        <div @click="cardClick">
          <Tooltip config="Helpful text" open-on-click suppress-description>
            <button aria-label="Helpful text">Trigger</button>
          </Tooltip>
        </div>
      `,
      setup: () => ({ cardClick })
    }
    render(Card)

    const trigger = screen.getByRole('button')
    await user.click(trigger)

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
    expect(cardClick).not.toHaveBeenCalled()
    expect(trigger).toHaveAccessibleName('Helpful text')
    expect(trigger).not.toHaveAccessibleDescription('Helpful text')
  })

  it('dismisses a click-opened tooltip with Escape', async () => {
    const user = userEvent.setup()
    render(Tooltip, {
      props: { config: 'Helpful text', openOnClick: true },
      slots: { default: '<button>Trigger</button>' }
    })

    await user.click(screen.getByRole('button'))
    await screen.findByRole('tooltip')
    await user.keyboard('{Escape}')

    await vi.waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('recomputes its modal lift each time it opens', async () => {
    const firstDialog = document.createElement('div')
    ZIndex.set('modal', firstDialog, 2400)
    openDialogs.push(firstDialog)
    const user = userEvent.setup()
    renderTooltip()
    const trigger = screen.getByRole('button')

    await user.hover(trigger)
    expect(Number((await screen.findByRole('tooltip')).style.zIndex)).toBe(
      Number(firstDialog.style.zIndex) + 1
    )
    await user.unhover(trigger)
    await vi.waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    const laterDialog = document.createElement('div')
    ZIndex.set('modal', laterDialog, 2400)
    openDialogs.push(laterDialog)
    await user.hover(trigger)

    expect(Number((await screen.findByRole('tooltip')).style.zIndex)).toBe(
      Number(laterDialog.style.zIndex) + 1
    )
  })

  it.for(['top', 'right', 'bottom', 'left'] as const)(
    'places content on the %s side',
    async (side) => {
      const user = userEvent.setup()
      renderTooltip('Helpful text', side)

      await user.hover(screen.getByRole('button'))

      expect(await screen.findByRole('tooltip')).toHaveAttribute(
        'data-side',
        side
      )
    }
  )
})
