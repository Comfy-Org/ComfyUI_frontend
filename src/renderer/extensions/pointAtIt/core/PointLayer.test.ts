import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  COMPANION_FINGERTIPS,
  COMPANION_FINGER_GAP,
  COMPANION_SIZE
} from './companionArt'
import { pointConfig } from './config'
import type { PointConfig } from './config'
import { placeAfterMarker } from './dockSlot'
import { createFakePointHost, settingAddress } from './fakePointHost'
import recordedStream from './fixtures/openrouterThinkingStream.recorded.txt?raw'
import { answers, messages } from './messages'
import { isOwnElement } from './pageElements'
import PointLayer from './PointLayer.vue'

const TOP_BAR =
  '<div data-testid="bar"><button>User</button><span data-testid="separator"></span><button>Agent</button></div>'
/** The layer without the companion; the companion's own cases come last. */
const config: PointConfig = {
  ...pointConfig,
  agent: 'scripted',
  companion: false
}

/** A model reply that stays open: the test sends the stream's parts as it likes. */
function pendingStream() {
  const encoder = new TextEncoder()
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream = controller
    }
  })
  return {
    response: new Response(body, {
      headers: { 'content-type': 'text/event-stream' }
    }),
    send: (text: string) => stream?.enqueue(encoder.encode(text)),
    end: () => stream?.close()
  }
}

function renderLayer(page: string) {
  document.body.innerHTML = page
  const host = createFakePointHost()
  host.topBarPlace = (own) =>
    placeAfterMarker(own, '[data-testid="bar"]', '[data-testid="separator"]')
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  return { user, ...render(PointLayer, { props: { host, config } }) }
}

function annotate() {
  return screen.getByRole('button', { name: messages.annotate })
}

describe('PointLayer: the Ask strip and the slot above it', () => {
  it('BA-01: Ask is one strip at the bottom centre of the visible canvas and not in the top bar', async () => {
    renderLayer(TOP_BAR)
    await nextTick()

    const inBar = within(screen.getByTestId('bar')).getAllByRole('button')

    expect(inBar.map((button) => button.textContent.trim())).toEqual([
      'User',
      'Agent'
    ])
    expect(screen.getByTestId('point-at-it-ask')).toHaveStyle({
      left: '640px',
      bottom: `${window.innerHeight - 800 + 10}px`
    })
    expect(
      within(screen.getByTestId('point-at-it-ask')).getByRole('button', {
        name: messages.annotate
      })
    ).toBeVisible()
    expect(screen.queryByTestId('point-at-it-slot')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('point-at-it-turn-strip')
    ).not.toBeInTheDocument()
  })

  it('P-02, BA-01: the strip works without a top bar at all', async () => {
    const { user } = renderLayer('')

    await user.click(annotate())

    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
  })

  it('BA-02: one press turns the mode on, keeps the list closed and puts the hint in the slot', async () => {
    const { user } = renderLayer(TOP_BAR)

    await user.click(annotate())

    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('point-at-it-capture')).toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('point-at-it-slot')).getByText(
        messages.annotateHint
      )
    ).toBeVisible()
  })

  it('SR-01, SR-03, SR-05: an added question shows the summary row; its count opens the list, and Clear takes the row away and brings the hint back', async () => {
    document.body.innerHTML = TOP_BAR
    const host = createFakePointHost()
    host.selection = [host.nodes[1].id]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(PointLayer, { props: { host, config } })
    await user.click(annotate())
    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('make this wider{Enter}')

    const slot = () => within(screen.getByTestId('point-at-it-slot'))
    expect(slot().getByRole('button', { name: messages.send(1) })).toBeVisible()
    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()

    await user.click(
      slot().getByRole('button', { name: messages.questionCount(1) })
    )
    expect(screen.getByTestId('point-at-it-panel')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: messages.hidePanel, expanded: true })
    )

    await user.click(slot().getByRole('button', { name: messages.clear }))
    expect(slot().getByText(messages.annotateHint)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: messages.send(1) })
    ).not.toBeInTheDocument()
  })

  it('P-05: the next press turns the mode off and takes the hint away', async () => {
    const { user } = renderLayer(TOP_BAR)
    await user.click(annotate())

    await user.click(annotate())

    expect(annotate()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('point-at-it-capture')).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-slot')).not.toBeInTheDocument()
  })

  it('P-06, BA-04: the caret opens the list in the slot without turning the mode on, and folds it again', async () => {
    const { user } = renderLayer(TOP_BAR)

    await user.click(screen.getByRole('button', { name: messages.showPanel }))

    expect(screen.getByTestId('point-at-it-panel')).toBeInTheDocument()
    expect(annotate()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('point-at-it-capture')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: messages.hidePanel, expanded: true })
    )
    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
  })

  it('P-08, BA-04: the list’s own fold control closes it and leaves the mode on', async () => {
    const { user } = renderLayer(TOP_BAR)
    await user.click(annotate())
    await user.click(screen.getByRole('button', { name: messages.showPanel }))

    await user.click(
      within(screen.getByTestId('point-at-it-panel')).getByRole('button', {
        name: messages.hidePanel
      })
    )

    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
  })

  it('P-05, BA-04: leaving the mode closes a list that has nothing in it', async () => {
    const { user } = renderLayer(TOP_BAR)
    await user.click(annotate())
    await user.click(screen.getByRole('button', { name: messages.showPanel }))

    await user.click(annotate())

    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
  })

  it('P-15, BA-21: the strip, the list and the slot count as the layer’s own, so none can be picked', async () => {
    const { user } = renderLayer(TOP_BAR)
    await user.click(annotate())
    await user.click(screen.getByRole('button', { name: messages.showPanel }))

    expect(isOwnElement(annotate())).toBe(true)
    expect(isOwnElement(screen.getByTestId('point-at-it-ask'))).toBe(true)
    expect(isOwnElement(screen.getByTestId('point-at-it-slot'))).toBe(true)
    expect(isOwnElement(screen.getByTestId('point-at-it-panel'))).toBe(true)
    expect(isOwnElement(screen.getByText('Agent'))).toBe(false)
  })
})

describe('PointLayer: asking, sending and following up', () => {
  it('K-02, SD-01, SD-05, TH-01, TH-03, TH-06, BB-01: a question sent right away is answered in a bubble that shows only the answer and takes a follow-up', async () => {
    document.body.innerHTML = TOP_BAR
    const host = createFakePointHost()
    host.selection = [host.nodes[1].id]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(PointLayer, {
      props: {
        host,
        config: {
          ...config,
          scripted: { replyDelayMs: 500, wrongTarget: false }
        }
      }
    })

    await user.click(annotate())
    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('make this wider{Control>}{Enter}{/Control}')

    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('point-at-it-loading')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(600)

    const bubble = within(screen.getByTestId('point-at-it-bubble'))
    expect(screen.queryByTestId('point-at-it-loading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
    expect(
      bubble.queryByRole('log', { name: messages.threadLabel })
    ).not.toBeInTheDocument()
    expect(
      bubble.getByText(answers.sizeLead('width', 1536, true))
    ).toBeVisible()
    const field = bubble.getByRole('textbox', { name: messages.followUpLabel })
    expect(field).not.toHaveFocus()

    await user.click(field)
    await user.keyboard('make it taller{Enter}')

    expect(screen.getByTestId('point-at-it-loading')).toBeInTheDocument()
    expect(bubble.getByRole('button', { name: messages.cancel })).toBeEnabled()

    await vi.advanceTimersByTimeAsync(600)

    expect(
      bubble.getByRole('log', { name: messages.threadLabel })
    ).toHaveTextContent(
      /make this wider.*Offered 1536 for width · not taken.*make it taller/
    )
    expect(
      bubble.getByText(answers.sizeLead('height', 1536, true))
    ).toBeVisible()
    expect(
      bubble.getByRole('textbox', { name: messages.followUpLabel })
    ).toHaveValue('')
  })
})

describe('PointLayer: the slot while a request thinks and after it', () => {
  const modelConfig: PointConfig = {
    ...pointConfig,
    agent: 'model',
    companion: false
  }
  const dockOpenConfig: PointConfig = {
    ...modelConfig,
    thinkingDockOpensOnSend: true
  }
  const FIRST_WORDS = "I'm checking which node s"
  const firstEvent = recordedStream.indexOf('data: {')
  const upToFirstWords = recordedStream.slice(
    0,
    recordedStream.indexOf('\n\n', firstEvent) + 2
  )
  const afterFirstWords = recordedStream.slice(upToFirstWords.length)

  async function sendOneQuestion(layerConfig: PointConfig = modelConfig) {
    document.body.innerHTML = TOP_BAR
    const host = createFakePointHost()
    host.selection = [host.nodes[1].id]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(PointLayer, { props: { host, config: layerConfig } })
    await user.click(annotate())
    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('make this wider{Control>}{Enter}{/Control}')
    return user
  }

  function slot() {
    return within(screen.getByTestId('point-at-it-slot'))
  }

  function askToggle() {
    return screen.getByRole('button', { name: messages.askThinking })
  }

  it('BA-25: by default Send shows no box: just the plain waiting line, and Ask opens the box with the full thinking', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    const user = await sendOneQuestion()

    expect(screen.queryByTestId('point-at-it-dock')).not.toBeInTheDocument()
    expect(slot().getByRole('status')).toHaveTextContent(messages.askWaiting)
    expect(slot().getByRole('status')).not.toHaveClass('border')
    expect(slot().queryByRole('button')).not.toBeInTheDocument()

    await user.click(askToggle())

    expect(screen.getByTestId('point-at-it-dock')).toBeInTheDocument()
  })

  it('BA-05, BA-07, BA-24: with the dock set to open, Send opens it with Thinking…, loads the trigger, Ask becomes the thinking toggle, and Cancel puts everything back', async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        })
    )
    const user = await sendOneQuestion(dockOpenConfig)

    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('point-at-it-loading')).toBeInTheDocument()
    expect(askToggle()).toBeEnabled()
    expect(askToggle()).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.queryByRole('button', { name: messages.annotate })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: messages.showPanel })
    ).toBeDisabled()
    expect(slot().getByRole('log')).toHaveTextContent(messages.askWaiting)

    await user.click(slot().getByRole('button', { name: messages.cancel }))

    expect(screen.queryByTestId('point-at-it-slot')).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-loading')).not.toBeInTheDocument()
    expect(annotate()).toBeEnabled()
  })

  it('BA-05, BA-06, BA-24: with the dock set to open, Ask folds it to one line that is no control, and opens it again', async () => {
    const reply = pendingStream()
    vi.mocked(fetch).mockResolvedValue(reply.response)
    const user = await sendOneQuestion(dockOpenConfig)

    reply.send(upToFirstWords)
    await vi.advanceTimersByTimeAsync(50)
    expect(slot().getByRole('log')).toHaveTextContent(FIRST_WORDS)

    await user.click(askToggle())

    expect(screen.queryByTestId('point-at-it-dock')).not.toBeInTheDocument()
    expect(askToggle()).toHaveAttribute('aria-pressed', 'false')
    expect(slot().getByRole('status')).toHaveTextContent(messages.askWaiting)
    expect(slot().queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('point-at-it-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-capture')).not.toBeInTheDocument()

    await user.click(askToggle())

    expect(screen.getByTestId('point-at-it-dock')).toBeInTheDocument()
    expect(askToggle()).toHaveAttribute('aria-pressed', 'true')
  })

  it('BA-09, BA-24: the answer ends the thinking toggle: Ask is the mode’s again, no chip is left, and the thinking is on the latest turn’s dot card', async () => {
    const reply = pendingStream()
    vi.mocked(fetch).mockResolvedValue(reply.response)
    const user = await sendOneQuestion()
    reply.send(upToFirstWords)
    await vi.advanceTimersByTimeAsync(50)

    reply.send(afterFirstWords)
    reply.end()
    await vi.advanceTimersByTimeAsync(100)

    expect(screen.getByTestId('point-at-it-bubble')).toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-dock')).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-loading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-slot')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: messages.askThinking })
    ).not.toBeInTheDocument()
    expect(annotate()).toHaveAttribute('aria-pressed', 'false')

    await user.click(annotate())

    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('point-at-it-dock')).not.toBeInTheDocument()

    await user.hover(
      screen.getByRole('button', {
        name: messages.turnDotLabel(1, 1, 'make this wider')
      })
    )
    const card = within(screen.getByTestId('point-at-it-turn-card'))
    await user.click(card.getByText(messages.thinking))
    expect(
      card.getByText(/I'm checking which node sets the picture's width/)
    ).toBeVisible()
  })

  it('BA-08: with thinking off, Send leaves one line with nothing to open', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    await sendOneQuestion({
      ...modelConfig,
      model: { ...modelConfig.model, showThinking: false }
    })

    expect(slot().getByRole('status')).toHaveTextContent(messages.askWaiting)
    expect(slot().queryByRole('button')).not.toBeInTheDocument()
    expect(annotate()).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: messages.askThinking })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-dock')).not.toBeInTheDocument()
  })

  it('BA-17, BA-18: a failed request leaves one line with Retry; the list shows the same sentence above Clear and Send', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { error: { code: 429, message: 'Rate limit exceeded' } },
        { status: 429 }
      )
    )
    const user = await sendOneQuestion()
    await vi.advanceTimersByTimeAsync(50)

    const sentence =
      'The model provider returned an error (status 429: Rate limit exceeded).'
    expect(slot().getByRole('alert')).toHaveTextContent(sentence)
    expect(screen.queryByTestId('point-at-it-dock')).not.toBeInTheDocument()
    expect(annotate()).toBeEnabled()
    expect(screen.getByLabelText(messages.unsentCount(1))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: messages.showPanel }))

    const list = within(screen.getByTestId('point-at-it-panel'))
    expect(list.getByRole('alert')).toHaveTextContent(sentence)
    expect(list.getByRole('button', { name: 'Send 1' })).toBeEnabled()

    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    await user.click(list.getByRole('button', { name: 'Retry' }))

    expect(screen.getByTestId('point-at-it-loading')).toBeInTheDocument()
  })
})

describe('PointLayer: the bubble while the agent walks through its answer', () => {
  function twoStepsForTheSameQuestion() {
    const host = createFakePointHost()
    const target = { kind: 'node', nodeId: host.nodes[1].id }
    const step = (text: string) => ({
      annotationId: 'comment-1',
      text,
      target,
      waitFor: null,
      offerEdit: null
    })
    const content = JSON.stringify({
      steps: [step('First, the node.'), step('Then its neighbour.')]
    })
    const event = JSON.stringify({ choices: [{ delta: { content } }] })
    vi.mocked(fetch).mockResolvedValue(
      new Response(`data: ${event}\n\ndata: [DONE]\n\n`, {
        headers: { 'content-type': 'text/event-stream' }
      })
    )
    return host
  }

  async function walkToTheSecondStep() {
    document.body.innerHTML = TOP_BAR
    const host = twoStepsForTheSameQuestion()
    host.selection = [host.nodes[1].id]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(PointLayer, {
      props: { host, config: { ...config, agent: 'model' } }
    })
    await user.click(annotate())
    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('what is this?{Control>}{Enter}{/Control}')
    await vi.advanceTimersByTimeAsync(100)
    return user
  }

  it('BB-01: shows only the current step, not the question or the steps before it', async () => {
    const user = await walkToTheSecondStep()
    const bubble = within(screen.getByTestId('point-at-it-bubble'))
    expect(bubble.getByText('First, the node.')).toBeVisible()

    await user.click(bubble.getByRole('button', { name: messages.next }))

    expect(bubble.getByText('Then its neighbour.')).toBeVisible()
    expect(bubble.queryByText('First, the node.')).not.toBeInTheDocument()
    expect(bubble.queryByText('what is this?')).not.toBeInTheDocument()
    expect(
      bubble.queryByRole('log', { name: messages.threadLabel })
    ).not.toBeInTheDocument()
    expect(
      bubble.getByRole('textbox', { name: messages.followUpLabel })
    ).toBeVisible()
    expect(bubble.getByText(messages.stepOf(2, 2))).toBeVisible()
  })

  it('BB-02: the steps are still readable by opening the thread again from its dot', async () => {
    const user = await walkToTheSecondStep()
    const bubble = within(screen.getByTestId('point-at-it-bubble'))
    await user.click(bubble.getByRole('button', { name: messages.next }))
    await user.click(bubble.getByRole('button', { name: messages.done }))

    await user.click(
      screen.getByRole('button', {
        name: messages.turnDotLabel(1, 1, 'what is this?')
      })
    )

    const reopened = within(screen.getByTestId('point-at-it-bubble'))
    expect(
      reopened.getByRole('log', { name: messages.threadLabel })
    ).toHaveTextContent(/what is this\?.*First, the node\./)
    expect(reopened.getByText('Then its neighbour.')).toBeVisible()
  })
})

describe('PointLayer: the strip of turns', () => {
  async function renderAnsweredTurn() {
    document.body.innerHTML = TOP_BAR
    const host = createFakePointHost()
    host.selection = [host.nodes[1].id]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(PointLayer, {
      props: {
        host,
        config: {
          ...config,
          scripted: { replyDelayMs: 500, wrongTarget: false }
        }
      }
    })
    await user.click(annotate())
    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('make this wider{Control>}{Enter}{/Control}')
    await vi.advanceTimersByTimeAsync(600)
    return user
  }

  it('TS-26: shows nothing before the first answered turn', async () => {
    const { user } = renderLayer(TOP_BAR)
    await user.click(annotate())

    expect(
      screen.queryByTestId('point-at-it-turn-strip')
    ).not.toBeInTheDocument()
  })

  it('TS-27: after the first answer the strip shows that turn and the current dot, with the panel closed, and the answer on screen is marked', async () => {
    await renderAnsweredTurn()

    const strip = within(screen.getByTestId('point-at-it-turn-strip'))
    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
    expect(
      strip.getByRole('button', {
        name: messages.turnDotLabel(1, 1, 'make this wider')
      })
    ).toHaveAttribute('aria-current', 'true')
    expect(
      strip.getByRole('button', { name: messages.nextTurnLabel(0) })
    ).toBeInTheDocument()
  })

  it('TS-28: belongs to the layer, so Ask mode can never pick it', async () => {
    await renderAnsweredTurn()

    const dot = screen.getByRole('button', {
      name: messages.turnDotLabel(1, 1, 'make this wider')
    })

    expect(isOwnElement(screen.getByTestId('point-at-it-turn-strip'))).toBe(
      true
    )
    expect(isOwnElement(dot)).toBe(true)
  })

  it('TS-29: pressing a dot after closing the answer opens that turn’s thread again', async () => {
    const user = await renderAnsweredTurn()
    expect(
      within(screen.getByTestId('point-at-it-bubble')).queryByRole('button', {
        name: messages.close
      })
    ).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('point-at-it-bubble')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: messages.turnDotLabel(1, 1, 'make this wider')
      })
    ).not.toHaveAttribute('aria-current')

    await user.click(
      screen.getByRole('button', {
        name: messages.turnDotLabel(1, 1, 'make this wider')
      })
    )

    const bubble = within(screen.getByTestId('point-at-it-bubble'))
    expect(
      bubble.getByRole('log', { name: messages.threadLabel })
    ).toHaveTextContent('make this wider')
    expect(
      bubble.getByText(answers.sizeLead('width', 1536, true))
    ).toBeVisible()
  })

  it('TS-30: the strip stays when the panel opens, and the panel no longer lists earlier turns', async () => {
    const user = await renderAnsweredTurn()

    await user.click(screen.getByRole('button', { name: messages.showPanel }))

    const panel = within(screen.getByTestId('point-at-it-panel'))
    expect(screen.getByTestId('point-at-it-turn-strip')).toBeInTheDocument()
    expect(panel.queryByText('make this wider')).not.toBeInTheDocument()
    expect(panel.queryByText(/^Turn 1/)).not.toBeInTheDocument()
  })
})

describe('PointLayer: the fennec companion', () => {
  const withCompanion: PointConfig = {
    ...config,
    companion: true,
    scripted: { replyDelayMs: 500, wrongTarget: false }
  }
  const modelWithCompanion: PointConfig = { ...withCompanion, agent: 'model' }
  /** Long enough for a few frames of her flight, short of its end. */
  const FLIGHT_FRAMES_MS = 50

  const companion = () => screen.getByTestId('point-at-it-companion')
  const frame = () => companion().dataset.frame
  const speech = () => screen.queryByTestId('point-at-it-companion-speech')

  function placeOf(element: HTMLElement) {
    const match = /translate\((?<x>-?[\d.]+)px, (?<y>-?[\d.]+)px\)/.exec(
      element.style.transform
    )
    return { x: Number(match?.groups?.x), y: Number(match?.groups?.y) }
  }

  function thought(text: string) {
    const delta = { reasoning: text }
    return `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`
  }

  function renderWithCompanion(layerConfig: PointConfig = withCompanion) {
    document.body.innerHTML = TOP_BAR
    const host = createFakePointHost()
    host.selection = [host.nodes[1].id]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(PointLayer, { props: { host, config: layerConfig } })
    return { user, host }
  }

  async function askToMakeItWider(user: ReturnType<typeof userEvent.setup>) {
    await user.keyboard('q')
    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('make this wider{Control>}{Enter}{/Control}')
  }

  function step(text: string, target: object | null) {
    return {
      annotationId: 'comment-1',
      text,
      target,
      waitFor: null,
      offerEdit: null
    }
  }

  /** The model's whole answer: these steps, then the end of the stream. */
  function answerWith(
    reply: ReturnType<typeof pendingStream>,
    steps: ReturnType<typeof step>[]
  ) {
    const content = JSON.stringify({ steps })
    reply.send(
      `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
    )
    reply.send('data: [DONE]\n\n')
    reply.end()
  }

  /** Elements have no layout in the test DOM: this gives one test id a size. */
  function giveSize(testId: string, size: { width: number; height: number }) {
    class SizedObserver implements ResizeObserver {
      constructor(private readonly report: ResizeObserverCallback) {}

      observe(target: Element) {
        if (!(target instanceof HTMLElement)) return
        if (target.dataset.testid !== testId) return
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

  it('CP-01, CP-19: waits at the bottom left of the canvas, 40 px in and 10 px up, resting', async () => {
    renderWithCompanion()
    await vi.advanceTimersByTimeAsync(50)

    expect(placeOf(companion())).toEqual({
      x: 40,
      y: 800 - 10 - COMPANION_SIZE.height
    })
    expect(frame()).toBe('idle')
  })

  it('CP-02: with the companion off there is no companion', () => {
    renderWithCompanion({ ...withCompanion, companion: false })

    expect(
      screen.queryByTestId('point-at-it-companion')
    ).not.toBeInTheDocument()
  })

  it('CP-22: there is no Ask strip at the bottom centre, and the slot above it has no hint, because she says it', async () => {
    document.body.innerHTML = TOP_BAR
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(PointLayer, {
      props: { host: createFakePointHost(), config: withCompanion }
    })
    await vi.advanceTimersByTimeAsync(50)

    expect(screen.queryByTestId('point-at-it-trigger')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: messages.showPanel })
    ).not.toBeInTheDocument()

    await user.keyboard('q')

    expect(screen.queryByTestId('point-at-it-slot')).not.toBeInTheDocument()
    expect(speech()).toHaveTextContent(messages.annotateHint)
  })

  it('CP-23: without the strip the list opens from the count on the summary row, and the list’s own control closes it', async () => {
    const { user } = renderWithCompanion()
    await user.keyboard('q')
    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('make this wider{Enter}')

    await user.click(
      within(screen.getByTestId('point-at-it-slot')).getByRole('button', {
        name: messages.questionCount(1)
      })
    )
    expect(screen.getByTestId('point-at-it-panel')).toBeInTheDocument()

    await user.click(
      within(screen.getByTestId('point-at-it-panel')).getByRole('button', {
        name: messages.hidePanel
      })
    )
    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
  })

  it('CP-24: she is a control for assistive technology: the tips button at rest, expanded while the tips are open, and the Ask button, pressed, while the mode is on', async () => {
    const { user } = renderWithCompanion()
    const tips = () => screen.getByRole('button', { name: messages.tipsLabel })

    expect(tips()).toBe(screen.getByTestId('point-at-it-companion-button'))
    expect(tips()).toHaveAttribute('aria-expanded', 'false')

    await user.click(tips())
    expect(tips()).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: messages.tipsStart }))
    expect(annotate()).toBe(screen.getByTestId('point-at-it-companion-button'))
    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
    expect(annotate()).not.toHaveAttribute('aria-expanded')
  })

  it('CP-24: while a request thinks she is the thinking toggle, named so, and pressing her opens the box', async () => {
    const reply = pendingStream()
    vi.mocked(fetch).mockResolvedValue(reply.response)
    const { user } = renderWithCompanion(modelWithCompanion)
    await askToMakeItWider(user)
    reply.send(thought('First I look at the node. '))
    await vi.advanceTimersByTimeAsync(50)

    const toggle = () =>
      screen.getByRole('button', { name: messages.askThinking })
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('point-at-it-dock')).not.toBeInTheDocument()

    await user.click(toggle())

    expect(screen.getByTestId('point-at-it-dock')).toBeInTheDocument()
    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
  })

  it('CP-25: with askStrip on the strip is back at the bottom centre with its two buttons, and she stays hidden from assistive technology', async () => {
    renderWithCompanion({ ...withCompanion, askStrip: true })
    await vi.advanceTimersByTimeAsync(50)

    expect(screen.getByTestId('point-at-it-ask')).toHaveStyle({ left: '640px' })
    expect(annotate()).toBeVisible()
    expect(
      screen.getByRole('button', { name: messages.showPanel })
    ).toBeVisible()
    expect(screen.getByTestId('point-at-it-companion-button')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })

  it('CP-20: while she is on, the canvas draws no info lines of its own, and draws them again when the layer is removed', () => {
    const host = createFakePointHost()
    const { unmount } = render(PointLayer, {
      props: { host, config: withCompanion }
    })

    expect(host.canvasInfoHidden).toBe(true)

    unmount()

    expect(host.canvasInfoHidden).toBe(false)
  })

  it.for<{ name: string; layerConfig: PointConfig }>([
    {
      name: 'without the companion',
      layerConfig: { ...withCompanion, companion: false }
    },
    {
      name: 'with hideCanvasInfo off',
      layerConfig: { ...withCompanion, hideCanvasInfo: false }
    }
  ])('CP-21: $name the canvas keeps its info lines', ({ layerConfig }) => {
    const host = createFakePointHost()

    render(PointLayer, { props: { host, config: layerConfig } })

    expect(host.canvasInfoHidden).toBe(false)
  })

  it.for<{ name: string; layerConfig: PointConfig; reacts: boolean }>([
    { name: 'by default', layerConfig: withCompanion, reacts: true },
    {
      name: 'with hoverReactions off',
      layerConfig: { ...withCompanion, hoverReactions: false },
      reacts: false
    }
  ])(
    'CP-33, CP-39: $name the pointer coming onto her at rest makes her react: $reacts',
    async ({ layerConfig, reacts }) => {
      const { user } = renderWithCompanion(layerConfig)
      await vi.advanceTimersByTimeAsync(50)

      await user.hover(screen.getByTestId('point-at-it-companion-button'))
      await vi.advanceTimersByTimeAsync(50)

      expect(companion().hasAttribute('data-reaction')).toBe(reacts)
    }
  )

  it('CP-03, CP-32: while the mode is on, a click on her turns it off, as Ask does', async () => {
    const { user } = renderWithCompanion()
    await user.keyboard('q')
    expect(annotate()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('point-at-it-capture')).toBeInTheDocument()

    await user.click(screen.getByTestId('point-at-it-companion-button'))

    expect(screen.queryByTestId('point-at-it-capture')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: messages.tipsLabel })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('CP-04: says the thinking in her bubble, one finished thought at a time, and leaves no waiting line in the Ask slot', async () => {
    const reply = pendingStream()
    vi.mocked(fetch).mockResolvedValue(reply.response)
    const { user } = renderWithCompanion(modelWithCompanion)
    await askToMakeItWider(user)

    expect(speech()).toHaveTextContent(messages.askWaiting)
    expect(speech()).toHaveAttribute('data-side', 'right')
    expect(frame()).not.toBe('idle')

    reply.send(thought('First I look at the node. Then I check the wid'))
    await vi.advanceTimersByTimeAsync(50)

    expect(speech()).toHaveTextContent('First I look at the node.')
    expect(screen.queryByTestId('point-at-it-slot')).not.toBeInTheDocument()

    reply.send(thought('th. That one is in the node.'))
    await vi.advanceTimersByTimeAsync(50)

    expect(speech()).toHaveTextContent('That one is in the node.')
    expect(speech()).not.toHaveTextContent('First I look at the node.')

    await vi.advanceTimersByTimeAsync(5000)
    expect(frame()).toBe('thinking')
  })

  it('CP-05: with the thinking box open she says nothing, and stays at the dock thinking', async () => {
    const reply = pendingStream()
    vi.mocked(fetch).mockResolvedValue(reply.response)
    const { user } = renderWithCompanion({
      ...modelWithCompanion,
      thinkingDockOpensOnSend: true
    })
    await askToMakeItWider(user)
    reply.send(thought('First I look at the node. '))
    await vi.advanceTimersByTimeAsync(5000)

    expect(screen.getByTestId('point-at-it-dock')).toBeInTheDocument()
    expect(speech()).not.toBeInTheDocument()
    expect(frame()).toBe('thinking')
    expect(companion().dataset.docked).toBe('true')
  })

  it('CP-06, CP-12: when the answer arrives she flies to the target and points at it, and the old pointer glyph is not drawn', async () => {
    const { user } = renderWithCompanion()
    await askToMakeItWider(user)

    await vi.advanceTimersByTimeAsync(560)
    expect(screen.getByTestId('point-at-it-bubble')).toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-pointer')).not.toBeInTheDocument()
    expect(frame()).toBe('happy')

    await vi.advanceTimersByTimeAsync(2000)

    const ring = screen.getByTestId('point-at-it-ring')
    const ringLeft = parseFloat(ring.style.left) + 3
    const ringMiddle =
      parseFloat(ring.style.top) + 3 + (parseFloat(ring.style.height) - 6) / 2
    const place = placeOf(companion())
    expect(frame()).toBe('point-right')
    expect(companion().dataset.docked).toBe('false')
    expect(place.x + COMPANION_FINGERTIPS.right.x).toBeCloseTo(
      ringLeft - COMPANION_FINGER_GAP
    )
    expect(place.y + COMPANION_FINGERTIPS.right.y).toBeCloseTo(ringMiddle)
  })

  it('CP-07, CP-11: the next step sends her on to its target, and Done sends her back to the dock, where she rests', async () => {
    const { user } = renderWithCompanion()
    await askToMakeItWider(user)
    await vi.advanceTimersByTimeAsync(2500)
    const firstSpot = placeOf(companion())
    expect(companion().dataset.docked).toBe('false')

    await user.click(
      within(screen.getByTestId('point-at-it-bubble')).getByRole('button', {
        name: messages.doItForMe
      })
    )
    await vi.advanceTimersByTimeAsync(FLIGHT_FRAMES_MS)
    expect(frame()).toBe('happy')
    await vi.advanceTimersByTimeAsync(2000)
    expect(placeOf(companion())).not.toEqual(firstSpot)
    expect(companion().dataset.docked).toBe('false')

    await user.click(
      within(screen.getByTestId('point-at-it-bubble')).getByRole('button', {
        name: messages.done
      })
    )
    await vi.advanceTimersByTimeAsync(2000)

    expect(companion().dataset.docked).toBe('true')
    expect(frame()).toBe('idle')
    expect(placeOf(companion())).toEqual({
      x: 40,
      y: 800 - 10 - COMPANION_SIZE.height
    })
  })

  it('CP-17: a step that points at nothing sends her back to the dock', async () => {
    const reply = pendingStream()
    vi.mocked(fetch).mockResolvedValue(reply.response)
    const { user, host } = renderWithCompanion(modelWithCompanion)
    await askToMakeItWider(user)
    answerWith(reply, [
      step('First, the node.', { kind: 'node', nodeId: host.nodes[1].id }),
      step('And in general, that is all.', null)
    ])
    await vi.advanceTimersByTimeAsync(2500)
    expect(companion().dataset.docked).toBe('false')
    expect(frame()).toBe('point-right')

    await user.click(
      within(screen.getByTestId('point-at-it-bubble')).getByRole('button', {
        name: messages.next
      })
    )
    await vi.advanceTimersByTimeAsync(2000)

    expect(companion().dataset.docked).toBe('true')
    expect(frame()).toBe('idle')
  })

  it('CP-08: while the next target is off screen she holds where she is, thinking, and goes to it when it comes into view', async () => {
    const reply = pendingStream()
    vi.mocked(fetch).mockResolvedValue(reply.response)
    const { user, host } = renderWithCompanion(modelWithCompanion)
    const stepsRow = host.nodes[0].settings[1]
    const inView = stepsRow.rect
    stepsRow.rect = { x: 3000, y: 232, width: 170, height: 18 }
    await askToMakeItWider(user)
    answerWith(reply, [
      step('First, the node.', { kind: 'node', nodeId: host.nodes[1].id }),
      step('Then the steps.', settingAddress(host.nodes[0].id, 'steps'))
    ])
    await vi.advanceTimersByTimeAsync(2500)
    const firstSpot = placeOf(companion())

    await user.click(
      within(screen.getByTestId('point-at-it-bubble')).getByRole('button', {
        name: messages.next
      })
    )
    await vi.advanceTimersByTimeAsync(2000)

    expect(host.revealed).toContainEqual(
      settingAddress(host.nodes[0].id, 'steps')
    )
    expect(placeOf(companion())).toEqual(firstSpot)
    expect(companion().dataset.docked).toBe('false')
    expect(frame()).toBe('thinking')

    stepsRow.rect = inView
    await vi.advanceTimersByTimeAsync(2500)

    expect(placeOf(companion())).not.toEqual(firstSpot)
    expect(frame()).toMatch(/^point-/)
  })

  it('CP-10: when the answer card is where she would stand, she stands on the other side of the target and points back at it', async () => {
    giveSize('point-at-it-bubble', { width: 440, height: 140 })
    const reply = pendingStream()
    vi.mocked(fetch).mockResolvedValue(reply.response)
    const { user, host } = renderWithCompanion(modelWithCompanion)
    await askToMakeItWider(user)
    answerWith(reply, [
      step('Raise the steps.', settingAddress(host.nodes[0].id, 'steps'))
    ])
    await vi.advanceTimersByTimeAsync(2500)

    const card = screen.getByTestId('point-at-it-bubble')
    const ring = screen.getByTestId('point-at-it-ring')
    const ringRight =
      parseFloat(ring.style.left) + parseFloat(ring.style.width) - 3
    const place = placeOf(companion())
    expect(parseFloat(card.style.left)).toBeLessThan(
      parseFloat(ring.style.left)
    )
    expect(frame()).toBe('point-left')
    expect(place.x + COMPANION_FINGERTIPS.left.x).toBeCloseTo(
      ringRight + COMPANION_FINGER_GAP
    )
  })

  it('CP-13: a failed request leaves her at the dock, resting, with the failure line and Retry in the Ask slot as before', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { error: { code: 429, message: 'Rate limit exceeded' } },
        { status: 429 }
      )
    )
    const { user } = renderWithCompanion(modelWithCompanion)
    await askToMakeItWider(user)
    await vi.advanceTimersByTimeAsync(2000)

    expect(frame()).toBe('idle')
    expect(companion().dataset.docked).toBe('true')
    expect(
      within(screen.getByTestId('point-at-it-slot')).getByRole('alert')
    ).toHaveTextContent('Rate limit exceeded')
    expect(
      within(screen.getByTestId('point-at-it-slot')).getByRole('button', {
        name: 'Retry'
      })
    ).toBeEnabled()
  })
  it('CP-26: a follow-up’s thinking is said by her too, where she stands, and the card keeps only that it waits', async () => {
    const first = pendingStream()
    const second = pendingStream()
    vi.mocked(fetch)
      .mockResolvedValueOnce(first.response)
      .mockResolvedValueOnce(second.response)
    const { user, host } = renderWithCompanion(modelWithCompanion)
    await askToMakeItWider(user)
    first.send(thought('An earlier thought about the width. '))
    const ksampler = { kind: 'node', nodeId: host.nodes[0].id }
    answerWith(first, [step('Raise the width.', ksampler)])
    await vi.advanceTimersByTimeAsync(2500)
    const spot = placeOf(companion())
    expect(frame()).toBe('point-right')

    const card = within(screen.getByTestId('point-at-it-bubble'))
    await user.click(
      card.getByRole('textbox', { name: messages.followUpLabel })
    )
    await user.keyboard('and the height?{Enter}')

    expect(speech()).toHaveTextContent(messages.askWaiting)
    expect(speech()).not.toHaveTextContent('An earlier thought')
    second.send(thought('Now the height. Then the ne'))
    await vi.advanceTimersByTimeAsync(50)

    expect(speech()).toHaveTextContent('Now the height.')
    expect(
      card.queryByRole('log', { name: messages.thinking })
    ).not.toBeInTheDocument()
    expect(card.getByText(messages.followUpWaiting)).toBeVisible()
    expect(card.getByRole('button', { name: messages.cancel })).toBeEnabled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(frame()).toBe('thinking')
    expect(placeOf(companion())).toEqual(spot)
    expect(companion().dataset.docked).toBe('false')

    answerWith(second, [step('Raise the height.', ksampler)])
    await vi.advanceTimersByTimeAsync(2500)

    expect(speech()).not.toBeInTheDocument()
    expect(frame()).toMatch(/^point-/)
  })

  it.for([
    { room: 'room on her other side', node: 0, side: 'left' },
    { room: 'no room there', node: 1, side: 'above' }
  ] as const)(
    'CP-27: with $room, her speech goes $side of her, off the ring she points at',
    async ({ node, side }) => {
      giveSize('point-at-it-companion-speech', { width: 200, height: 60 })
      const first = pendingStream()
      vi.mocked(fetch)
        .mockResolvedValueOnce(first.response)
        .mockImplementation(() => new Promise(() => {}))
      const { user, host } = renderWithCompanion(modelWithCompanion)
      await askToMakeItWider(user)
      answerWith(first, [
        step('Here.', { kind: 'node', nodeId: host.nodes[node].id })
      ])
      await vi.advanceTimersByTimeAsync(2500)

      await user.click(
        within(screen.getByTestId('point-at-it-bubble')).getByRole('textbox', {
          name: messages.followUpLabel
        })
      )
      await user.keyboard('why?{Enter}')

      expect(speech()).toHaveAttribute('data-side', side)
    }
  )

  /** Ask is on with nothing selected, so no box opens and the hint is up. */
  async function askWithNothingSelected() {
    document.body.innerHTML = TOP_BAR
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(PointLayer, {
      props: { host: createFakePointHost(), config: withCompanion }
    })
    await user.keyboard('q')
    return user
  }

  it('CP-40: with Ask on and nothing asked yet she says the hint, her mouth moves and then she rests with the bubble up, and nothing is drawn at the bottom centre', async () => {
    await askWithNothingSelected()

    expect(speech()).toHaveTextContent(messages.annotateHint)
    expect(frame()).toMatch(/^talk-/)
    expect(screen.queryByTestId('point-at-it-slot')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(5000)

    expect(frame()).toBe('idle')
    expect(speech()).toHaveTextContent(messages.annotateHint)
  })

  it('CP-41: the hint goes when a comment box opens or a question is added, she says it again when Ask waits for a click again, and it goes with the mode', async () => {
    // The test DOM has no layout, so no element is under a point: a click
    // picks the node whose rect holds it.
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => []
    })
    onTestFinished(() => {
      Reflect.deleteProperty(document, 'elementsFromPoint')
    })
    const user = await askWithNothingSelected()
    const slot = () => within(screen.getByTestId('point-at-it-slot'))
    expect(speech()).toHaveTextContent(messages.annotateHint)

    await user.pointer({
      keys: '[MouseLeft]',
      target: screen.getByTestId('point-at-it-capture'),
      coords: { clientX: 500, clientY: 200 }
    })
    expect(screen.getByTestId('point-at-it-comment-box')).toBeInTheDocument()
    expect(speech()).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('textbox', { name: messages.commentLabel })
    )
    await user.keyboard('make this wider{Enter}')
    expect(
      slot().getByRole('button', { name: messages.questionCount(1) })
    ).toBeVisible()
    expect(speech()).not.toBeInTheDocument()

    await user.click(slot().getByRole('button', { name: messages.clear }))
    expect(speech()).toHaveTextContent(messages.annotateHint)
    expect(frame()).toMatch(/^talk-/)

    await user.keyboard('{Escape}')
    expect(speech()).not.toBeInTheDocument()
  })

  describe('the card she opens when she is pressed', () => {
    const tips = () => screen.queryByTestId('point-at-it-companion-tips')
    const herButton = () => screen.getByTestId('point-at-it-companion-button')
    const asksWithoutSelection = () => {
      document.body.innerHTML = TOP_BAR
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(PointLayer, {
        props: { host: createFakePointHost(), config: withCompanion }
      })
      return user
    }

    it('CP-28: a click on her at rest opens her card beside her, with a field ready to type in, questions to try and a way to point at something, and does not start asking', async () => {
      const { user } = renderWithCompanion()

      await user.click(herButton())

      const offer = within(
        screen.getByRole('dialog', { name: messages.tipsLabel })
      )
      expect(offer.getByText(messages.tipsTitle)).toBeVisible()
      expect(
        offer.getByRole('textbox', { name: messages.tipsField })
      ).toHaveFocus()
      expect(
        offer.getByTestId('point-at-it-companion-context')
      ).toHaveTextContent('Empty Latent Image')
      expect(
        offer.getByRole('button', { name: messages.card.whatThisDoes })
      ).toBeVisible()
      expect(
        offer.getByRole('button', { name: messages.tipsStart })
      ).toBeVisible()
      expect(tips()).toHaveAttribute('data-side', 'right')
      expect(
        screen.queryByTestId('point-at-it-capture')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('point-at-it-comment-box')
      ).not.toBeInTheDocument()
    })

    it.for<{
      name: string
      close: (user: ReturnType<typeof userEvent.setup>) => Promise<void>
    }>([
      {
        name: 'a second click on her',
        close: (user) => user.click(herButton())
      },
      { name: 'Esc', close: (user) => user.keyboard('{Escape}') },
      {
        name: 'its close button',
        close: (user) =>
          user.click(
            within(screen.getByRole('dialog')).getByRole('button', {
              name: messages.close
            })
          )
      },
      {
        name: 'a click on the page',
        close: (user) => user.click(screen.getByText('User'))
      }
    ])('CP-29: $name closes them', async ({ close }) => {
      const { user } = renderWithCompanion()
      await user.click(herButton())
      expect(tips()).toBeInTheDocument()

      await close(user)

      expect(tips()).not.toBeInTheDocument()
      expect(herButton()).toHaveAttribute('aria-expanded', 'false')
    })

    it('CP-30: Start asking turns the mode on and puts the tips away', async () => {
      const { user } = renderWithCompanion()
      await user.click(herButton())

      await user.click(screen.getByRole('button', { name: messages.tipsStart }))

      expect(tips()).not.toBeInTheDocument()
      expect(annotate()).toHaveAttribute('aria-pressed', 'true')
      expect(
        screen.getByRole('textbox', { name: messages.commentLabel })
      ).toHaveValue('')
    })

    it('CP-30, CP-64: so does the key once the field has no focus; in the field it types the letter', async () => {
      const { user } = renderWithCompanion()
      await user.click(herButton())
      const field = screen.getByRole('textbox', { name: messages.tipsField })

      await user.keyboard('q')

      expect(field).toHaveValue('q')
      expect(tips()).toBeInTheDocument()
      expect(
        screen.queryByTestId('point-at-it-capture')
      ).not.toBeInTheDocument()

      field.blur()
      await user.keyboard('q')

      expect(tips()).not.toBeInTheDocument()
      expect(annotate()).toHaveAttribute('aria-pressed', 'true')
    })

    it('CP-62: a question to try is sent at once, about what is selected, and answered', async () => {
      const { user } = renderWithCompanion()
      await user.click(herButton())

      await user.click(
        screen.getByRole('button', { name: messages.card.larger })
      )

      expect(tips()).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('point-at-it-capture')
      ).not.toBeInTheDocument()
      expect(speech()).toHaveTextContent(messages.askWaiting)

      await vi.advanceTimersByTimeAsync(600)

      expect(
        within(screen.getByTestId('point-at-it-bubble')).getByText(
          answers.sizeLead('width', 1536, true)
        )
      ).toBeVisible()
    })

    it('CP-62: with nothing selected it is sent all the same, and the answer is hers at the dock', async () => {
      const user = asksWithoutSelection()
      await user.click(herButton())

      await user.click(
        screen.getByRole('button', { name: messages.card.explain })
      )
      await vi.advanceTimersByTimeAsync(600)

      expect(
        within(screen.getByTestId('point-at-it-bubble')).getByText(
          answers.tourLead(3)
        )
      ).toBeVisible()
      expect(screen.getByTestId('point-at-it-tail')).toBeInTheDocument()
      expect(screen.queryByTestId('point-at-it-ring')).not.toBeInTheDocument()
      expect(companion().dataset.docked).toBe('true')
    })

    it('CP-91: asking her to explain the workflow takes the person through it: a lead-in at her dock first, then a stop on each main node', async () => {
      const user = asksWithoutSelection()
      await user.click(herButton())
      await user.click(
        screen.getByRole('button', { name: messages.card.explain })
      )
      await vi.advanceTimersByTimeAsync(600)
      const bubble = () => within(screen.getByTestId('point-at-it-bubble'))
      expect(bubble().getByText(messages.stepOf(1, 4))).toBeVisible()

      await user.click(bubble().getByRole('button', { name: messages.next }))
      await vi.advanceTimersByTimeAsync(600)

      expect(bubble().getByText(messages.stepOf(2, 4))).toBeVisible()
      expect(bubble().getByText(/^KSampler: Denoises a latent/)).toBeVisible()
      expect(screen.getByTestId('point-at-it-ring')).toBeInTheDocument()
    })

    it('CP-03: a mouse click on her leaves no focus on her, so a key pressed afterwards cannot bring up her focus ring', async () => {
      const { user } = renderWithCompanion()

      await user.click(herButton())
      expect(tips()).toBeInTheDocument()
      expect(herButton()).not.toHaveFocus()

      await user.keyboard('{Escape}')
      expect(tips()).not.toBeInTheDocument()
      expect(herButton()).not.toHaveFocus()
    })

    it('CP-24: from the keyboard she keeps her focus until Enter opens her card, and then the field has it', async () => {
      const { user } = renderWithCompanion()
      screen.getByRole('button', { name: 'Agent' }).focus()

      await user.tab()
      expect(herButton()).toHaveFocus()
      await user.keyboard('{Enter}')

      expect(tips()).toBeInTheDocument()
      expect(
        screen.getByRole('textbox', { name: messages.tipsField })
      ).toHaveFocus()
    })
  })
})
