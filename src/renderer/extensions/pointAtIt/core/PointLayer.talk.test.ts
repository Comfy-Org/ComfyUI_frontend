import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { pointConfig } from './config'
import type { PointConfig } from './config'
import { createFakePointHost } from './fakePointHost'
import { answers, messages } from './messages'
import PointLayer from './PointLayer.vue'

const config: PointConfig = {
  ...pointConfig,
  agent: 'scripted',
  companion: true,
  scripted: { replyDelayMs: 500, wrongTarget: false }
}

/** Where her card goes when it sits to her right: her head's right edge and the gap. */
const RIGHT_OF_HER_HEAD = '146px'

function renderLayer({ selected = false } = {}) {
  document.body.innerHTML = ''
  const host = createFakePointHost()
  if (selected) host.selection = [host.nodes[1].id]
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(PointLayer, { props: { host, config } })
  return { user, host }
}

const herButton = () => screen.getByTestId('point-at-it-companion-button')
const her = () => screen.getByTestId('point-at-it-companion')
const card = () => screen.queryByTestId('point-at-it-companion-tips')
const speech = () => screen.queryByTestId('point-at-it-companion-speech')
const answer = () => screen.getByTestId('point-at-it-bubble')
const field = () => screen.getByRole('textbox', { name: messages.tipsField })
const replyField = () =>
  screen.getByRole('textbox', { name: messages.followUpLabel })

/** Elements have no layout in the test DOM: this gives some test ids a size. */
function giveSizes(sizes: Record<string, { width: number; height: number }>) {
  class SizedObserver implements ResizeObserver {
    constructor(private readonly report: ResizeObserverCallback) {}

    observe(target: Element) {
      if (!(target instanceof HTMLElement)) return
      const size = Object.entries(sizes).find(
        ([testId]) => testId === target.dataset.testid
      )?.[1]
      if (!size) return
      const box = { inlineSize: size.width, blockSize: size.height }
      this.report(
        [
          {
            target,
            borderBoxSize: [box],
            contentBoxSize: [box],
            devicePixelContentBoxSize: [box],
            contentRect: new DOMRect(0, 0, size.width, size.height)
          }
        ],
        this
      )
    }

    unobserve() {}

    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', SizedObserver)
}

describe('PointLayer: talking to her', () => {
  it('CP-60: a click on her, a message and Enter: she thinks, and her reply is a card on her, with nothing pinned', async () => {
    const { user } = renderLayer()
    await user.click(herButton())
    expect(field()).toHaveFocus()

    await user.keyboard('hi{Enter}')

    expect(card()).not.toBeInTheDocument()
    expect(speech()).toHaveTextContent(messages.askWaiting)

    await vi.advanceTimersByTimeAsync(600)

    expect(speech()).not.toBeInTheDocument()
    expect(
      within(answer()).getByText(answers.greeting, { exact: false })
    ).toBeVisible()
    expect(answer().style.left).toBe(RIGHT_OF_HER_HEAD)
    expect(screen.getByTestId('point-at-it-tail')).toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-ring')).not.toBeInTheDocument()
    expect(
      screen.queryAllByRole('button', {
        name: /^(Answered question|Question) /
      })
    ).toEqual([])
    expect(her().dataset.docked).toBe('true')
    expect(replyField()).toBeVisible()
    expect(
      within(answer()).getByRole('button', { name: messages.done })
    ).toBeEnabled()
  })

  it('CP-61: with a node selected the message is pinned on it, and the answer points there', async () => {
    const { user } = renderLayer({ selected: true })
    await user.click(herButton())

    await user.keyboard('what is this?{Enter}')

    expect(
      screen.getByRole('button', {
        name: messages.pinLabel(1, 'Empty Latent Image')
      })
    ).toBeVisible()

    await vi.advanceTimersByTimeAsync(1200)

    expect(screen.getByTestId('point-at-it-ring')).toBeInTheDocument()
    expect(her().dataset.docked).toBe('false')
  })

  it('CP-63: any answer that points at nothing is her reply at the dock, also for a message about a selected node', async () => {
    const { user } = renderLayer({ selected: true })
    await user.click(herButton())

    await user.keyboard('why is the sky blue?{Enter}')
    await vi.advanceTimersByTimeAsync(700)

    expect(answer().style.left).toBe(RIGHT_OF_HER_HEAD)
    expect(screen.getByTestId('point-at-it-tail')).toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-ring')).not.toBeInTheDocument()
    expect(her().dataset.docked).toBe('true')
  })

  it('CP-60: Enter with nothing typed sends nothing', async () => {
    const { user } = renderLayer()
    await user.click(herButton())

    await user.keyboard('{Enter}')
    await user.keyboard('   {Enter}')
    await vi.advanceTimersByTimeAsync(600)

    expect(card()).toBeInTheDocument()
    expect(speech()).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-bubble')).not.toBeInTheDocument()
  })

  it('CP-65: her reply goes on in the same card, with the thread so far, Done ends it, and the next message is a new turn', async () => {
    const { user } = renderLayer()
    await user.click(herButton())
    await user.keyboard('hi{Enter}')
    await vi.advanceTimersByTimeAsync(600)

    await user.click(replyField())
    await user.keyboard('make it taller{Enter}')
    expect(speech()).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1200)

    const thread = within(answer()).getByRole('log', {
      name: messages.threadLabel
    })
    expect(thread).toHaveTextContent('hi')
    expect(thread).toHaveTextContent('make it taller')
    expect(
      within(answer()).getByText(answers.sizeLead('height', 1536, true))
    ).toBeVisible()
    expect(
      within(screen.getByTestId('point-at-it-turn-strip')).getAllByRole(
        'button'
      )
    ).toHaveLength(2)

    await user.keyboard('{Escape}')
    await vi.advanceTimersByTimeAsync(2000)
    expect(her().dataset.docked).toBe('true')
    await user.click(herButton())
    await user.keyboard('hello again{Enter}')
    await vi.advanceTimersByTimeAsync(600)

    expect(
      within(answer()).getByText(answers.greeting, { exact: false })
    ).toBeVisible()
    expect(
      within(screen.getByTestId('point-at-it-turn-strip')).getAllByRole(
        'button'
      )
    ).toHaveLength(3)
  })

  it('CP-66: while a follow-up waits, her thinking line takes a side her card does not use', async () => {
    giveSizes({
      'point-at-it-bubble': { width: 320, height: 80 },
      'point-at-it-companion-speech': { width: 200, height: 60 }
    })
    const { user } = renderLayer()
    await user.click(herButton())
    await user.keyboard('hi{Enter}')
    await vi.advanceTimersByTimeAsync(600)
    expect(answer().style.left).toBe(RIGHT_OF_HER_HEAD)

    await user.click(replyField())
    await user.keyboard('and the sampler?{Enter}')

    expect(speech()).toHaveAttribute('data-side', 'above')
  })
})
