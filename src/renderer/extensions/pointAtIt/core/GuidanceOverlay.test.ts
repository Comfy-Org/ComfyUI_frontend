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
