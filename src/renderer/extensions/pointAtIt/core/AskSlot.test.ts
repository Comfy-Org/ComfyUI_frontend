import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import AskSlot from './AskSlot.vue'
import { settingAddress } from './fakePointHost'
import { describeFailure, messages } from './messages'
import type { SlotView } from './slotView'
import { emptyConversation } from './turns'
import type { Annotation, Conversation } from './turns'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')
function annotation(id: string, comment: string): Annotation {
  return { id, targets: [width], label: 'Empty Latent Image › width', comment }
}
const twoUnsent: Conversation = {
  turns: [],
  unsent: [
    annotation('comment-1', 'make this wider'),
    annotation('comment-2', 'what is this?')
  ]
}

const failure = {
  kind: 'provider',
  detail: 'the reply was cut off at the token limit'
} as const
const thinking = {
  requestId: 'request-1',
  text: 'Looking at the workflow.\n…so the change goes there, not on the sampler',
  done: false
}
const baseProps: ComponentProps<typeof AskSlot> = {
  view: { kind: 'none' },
  conversation: emptyConversation,
  pins: [],
  phase: 'idle',
  failure: null,
  thinking: null,
  cap: 240
}

function renderSlot(view: SlotView, props: Partial<typeof baseProps> = {}) {
  return render(AskSlot, { props: { ...baseProps, ...props, view } })
}

describe('AskSlot', () => {
  it('BA-21: holds exactly one thing, named by its kind', () => {
    renderSlot({ kind: 'hint' })

    expect(screen.getByTestId('point-at-it-slot')).toHaveAttribute(
      'data-kind',
      'hint'
    )
    expect(screen.getByText(messages.annotateHint)).toBeVisible()
    expect(screen.queryByTestId('point-at-it-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('point-at-it-dock')).not.toBeInTheDocument()
  })

  it('SR-01, SR-02: the summary row counts the unsent questions and offers Clear then Send n', () => {
    renderSlot(
      { kind: 'summary' },
      { phase: 'annotating', conversation: twoUnsent }
    )

    const row = screen.getByTestId('point-at-it-slot')
    expect(row).toHaveAttribute('data-kind', 'summary')
    expect(
      screen.getByRole('button', { name: messages.questionCount(2) })
    ).toBeVisible()
    const buttons = within(row)
      .getAllByRole('button')
      .map((button) => button.textContent.trim())
    expect(buttons.slice(-2)).toEqual([messages.clear, messages.send(2)])
  })

  it('SR-03, SR-04, SR-05: the count opens the list; Clear and Send act on the unsent questions', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSlot(
      { kind: 'summary' },
      { phase: 'annotating', conversation: twoUnsent }
    )

    await user.click(
      screen.getByRole('button', { name: messages.questionCount(2) })
    )
    await user.click(screen.getByRole('button', { name: messages.clear }))
    await user.click(screen.getByRole('button', { name: messages.send(2) }))

    expect(emitted('expand')).toHaveLength(1)
    expect(emitted('clear')).toHaveLength(1)
    expect(emitted('send')).toHaveLength(1)
  })

  it('BA-06, BA-25: a waiting request shows the latest finished thought as plain text, without a box and without a control', () => {
    renderSlot({ kind: 'waiting' }, { phase: 'waiting', thinking })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Looking at the workflow.'
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('so the change')
    expect(screen.getByRole('status')).not.toHaveClass('border')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('BA-08: without thinking the line says Thinking…', () => {
    renderSlot({ kind: 'waiting' }, { phase: 'waiting' })

    expect(screen.getByRole('status')).toHaveTextContent(messages.askWaiting)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('BA-10: says so when the model sent no thinking', () => {
    renderSlot({ kind: 'noThinking' })

    expect(screen.getByRole('status')).toHaveTextContent(messages.noThinking)
  })

  it('BA-17: a failure is one line with Retry, the whole sentence kept for hovering', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSlot(
      { kind: 'failure' },
      { phase: 'failed', failure }
    )

    const sentence = describeFailure(failure)
    expect(screen.getByRole('alert')).toHaveTextContent(sentence)
    expect(screen.getByText(sentence)).toHaveAttribute('title', sentence)

    await user.click(screen.getByRole('button', { name: messages.retry }))
    expect(emitted('retry')).toHaveLength(1)
  })

  it('BA-05: the dock can be cancelled only while its request waits', () => {
    const { rerender } = renderSlot(
      { kind: 'thinking', tall: false },
      { phase: 'waiting', thinking }
    )

    expect(screen.getByRole('button', { name: messages.cancel })).toBeVisible()

    return rerender({ phase: 'idle' }).then(() => {
      expect(
        screen.queryByRole('button', { name: messages.cancel })
      ).not.toBeInTheDocument()
    })
  })

  it('BA-04: the list is the existing list, folded by its own control', async () => {
    const user = userEvent.setup()
    const { emitted } = renderSlot({ kind: 'questions' })

    await user.click(screen.getByRole('button', { name: messages.hidePanel }))

    expect(screen.getByTestId('point-at-it-panel')).toBeVisible()
    expect(emitted('collapse')).toHaveLength(1)
  })
})
