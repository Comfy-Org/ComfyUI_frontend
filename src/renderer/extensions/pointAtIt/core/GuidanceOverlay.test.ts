import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import GuidanceOverlay from './GuidanceOverlay.vue'
import { messages } from './messages'

type Props = ComponentProps<typeof GuidanceOverlay>

const width = settingAddress(createNodeLocatorId(null, 5), 'width')
const baseProps: Props = {
  step: {
    annotationId: 'comment-1',
    text: 'Change width to 1280.',
    target: width,
    waitFor: null,
    offerEdit: { target: width, value: 1280 },
    problems: []
  },
  index: 0,
  total: 2,
  editFailed: false,
  view: {
    ring: { x: 260, y: 384, width: 180, height: 18 },
    pointer: { x: 424, y: 393 },
    landed: true
  },
  answers: { number: 1, label: 'Save Image' },
  thread: [{ kind: 'comment', text: 'make this wider' }]
}

function renderBubble(props: Partial<Props> = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const rendered = render(GuidanceOverlay, {
    props: { ...baseProps, ...props }
  })
  return { user, ...rendered }
}

describe('GuidanceOverlay: the thread in the bubble', () => {
  it('TH-01: shows the question above the answer, with a follow-up field that does not take focus', () => {
    renderBubble()

    expect(
      screen.getByRole('log', { name: messages.threadLabel })
    ).toHaveTextContent('make this wider')
    expect(screen.getByText('Change width to 1280.')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: messages.followUpLabel })
    ).not.toHaveFocus()
    expect(screen.getByText('1')).toBeVisible()
  })

  it('TH-02: a step that answers no question has no thread and no follow-up field', () => {
    renderBubble({ thread: null, answers: null })

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  it('TH-03: Enter in the field asks to send the follow-up', async () => {
    const { user, emitted } = renderBubble()

    await user.click(
      screen.getByRole('textbox', { name: messages.followUpLabel })
    )
    await user.keyboard('a bit more than that{Enter}')

    expect(emitted('followUp')).toEqual([['a bit more than that']])
  })

  it('TH-04: while a follow-up waits the step’s own buttons are disabled', () => {
    renderBubble({
      followUp: {
        status: 'waiting',
        requestId: 'request-3',
        text: 'why?',
        startedAt: Date.now()
      }
    })

    expect(
      screen.getByRole('button', { name: messages.doItForMe })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: messages.next })).toBeDisabled()
    expect(screen.getByRole('button', { name: messages.cancel })).toBeEnabled()
  })

  it('TH-06: when the reply arrives the field is empty again for the next follow-up', async () => {
    const { user, rerender } = renderBubble()
    await user.click(
      screen.getByRole('textbox', { name: messages.followUpLabel })
    )
    await user.keyboard('a bit more than that')

    await rerender({
      step: { ...baseProps.step, text: 'Go to 1408.' },
      thread: [
        { kind: 'comment', text: 'make this wider' },
        {
          kind: 'followUp',
          id: 'followUp-1',
          text: 'a bit more than that',
          thinking: ''
        }
      ]
    })

    expect(
      screen.getByRole('textbox', { name: messages.followUpLabel })
    ).toHaveValue('')
    expect(screen.getByText('Go to 1408.')).toBeVisible()
  })
})

describe('GuidanceOverlay: the pointer and where the card is', () => {
  const flying = {
    ring: { x: 260, y: 384, width: 180, height: 18 },
    pointer: { x: 100, y: 120 },
    landed: false
  }

  it('shows the pointer glyph while it flies to the target', () => {
    renderBubble({ view: flying })

    expect(screen.getByTestId('point-at-it-pointer')).toBeInTheDocument()
  })

  it('CP-12: draws no pointer glyph when the companion is the pointer', () => {
    renderBubble({ view: flying, showPointer: false })

    expect(screen.queryByTestId('point-at-it-pointer')).not.toBeInTheDocument()
    expect(screen.getByTestId('point-at-it-ring')).toBeInTheDocument()
    expect(screen.getByTestId('point-at-it-bubble')).toBeInTheDocument()
  })

  it('CP-10: reports where the card is, and that it is gone when it goes', () => {
    const { emitted, unmount } = renderBubble()
    const card = screen.getByTestId('point-at-it-bubble')

    expect(emitted('placed')[0]).toEqual([
      {
        x: parseFloat(card.style.left),
        y: parseFloat(card.style.top),
        width: 0,
        height: 0
      }
    ])

    unmount()

    expect(emitted('placed').at(-1)).toEqual([null])
  })
})

describe('GuidanceOverlay: her reply, which points at nothing', () => {
  const head = { x: 70, y: 658, width: 60, height: 56 }
  const reply: Partial<Props> = {
    step: {
      annotationId: 'comment-1',
      text: 'Hello! Ask me about any node.',
      target: null,
      waitFor: null,
      offerEdit: null,
      problems: []
    },
    index: 0,
    total: 1,
    answers: null,
    thread: [],
    view: { ring: null, pointer: { x: 640, y: 400 }, landed: false },
    attachTo: head
  }

  it('CP-63: the card is attached to her head, to its right, with its tail, and there is no ring', () => {
    renderBubble(reply)

    expect(screen.getByTestId('point-at-it-bubble').style.left).toBe(
      `${head.x + head.width + 16}px`
    )
    expect(screen.getByTestId('point-at-it-tail')).toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-ring')).not.toBeInTheDocument()
  })

  it('CP-63: it is a reply and not a step: no step count, no question number, Done, and a field to reply in', async () => {
    const { user, emitted } = renderBubble(reply)

    expect(screen.queryByText(messages.stepOf(1, 1))).not.toBeInTheDocument()
    expect(screen.queryByText(/^Answers question/)).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('textbox', { name: messages.followUpLabel })
    )
    await user.keyboard('and the sampler?{Enter}')
    await user.click(screen.getByRole('button', { name: messages.done }))

    expect(emitted('followUp')).toEqual([['and the sampler?']])
    expect(emitted('done')).toHaveLength(1)
  })

  it('CP-63: without her head the card is placed by the pointer as before, with no tail', () => {
    renderBubble({ ...reply, attachTo: null })

    expect(screen.queryByTestId('point-at-it-tail')).not.toBeInTheDocument()
  })

  it('CP-63: a step with a ring is attached to the ring, whatever else is given', () => {
    renderBubble({ ...baseProps, attachTo: head })

    expect(screen.getByTestId('point-at-it-ring')).toBeInTheDocument()
    expect(
      parseFloat(screen.getByTestId('point-at-it-bubble').style.left)
    ).toBeGreaterThan(260)
  })
})
