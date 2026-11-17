import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import CommentPanel from './CommentPanel.vue'
import { settingAddress } from './fakePointHost'
import { messages } from './messages'
import type { Annotation, Conversation } from './turns'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')
const pinned = { x: 260, y: 384, width: 180, height: 18 }

function annotation(id: string, comment: string): Annotation {
  return { id, targets: [width], label: 'Empty Latent Image › width', comment }
}

const unsentOnly: Conversation = {
  turns: [],
  unsent: [
    annotation('comment-1', 'make this wider'),
    annotation('comment-2', 'what is this?')
  ]
}
const secondTurn: Conversation = {
  turns: [
    {
      id: 'turn-1',
      sentAt: Date.UTC(2026, 10, 11, 14, 30),
      comments: [...unsentOnly.unsent],
      steps: [],
      thinking: 'Checking which node sets the width.',
      followUps: [
        {
          id: 'followUp-1',
          commentId: 'comment-1',
          text: 'a bit more than that',
          steps: [],
          thinking: ''
        }
      ]
    }
  ],
  unsent: [annotation('comment-3', 'a bit more than that')]
}

const baseProps: ComponentProps<typeof CommentPanel> = {
  conversation: unsentOnly,
  pins: [
    { id: 'comment-1', number: 1, rect: pinned, missing: false, locked: false },
    { id: 'comment-2', number: 2, rect: null, missing: false, locked: false }
  ],
  phase: 'idle',
  failure: null
}

function renderPanel(props: Partial<ComponentProps<typeof CommentPanel>> = {}) {
  return render(CommentPanel, { props: { ...baseProps, ...props } })
}

describe('CommentPanel', () => {
  it('P-08, BA-04: its fold control asks to close the list', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel()

    await user.click(screen.getByRole('button', { name: messages.hidePanel }))

    expect(emitted()).toHaveProperty('collapse')
  })

  it('E-03: says which comment’s target is not on screen right now', () => {
    renderPanel()

    expect(screen.getAllByText(messages.notOnScreen)).toHaveLength(1)
  })

  it('TU-03: lists only the current turn’s questions, with numbers continuing, and leaves earlier turns to the strip', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel({ conversation: secondTurn })

    expect(screen.queryByText('make this wider')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Turn 1/)).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeVisible()

    await user.click(screen.getByText('a bit more than that'))

    expect(emitted('open')).toEqual([['comment-3']])
  })

  it('TU-04, TU-07: Send and Clear count only the current turn’s unsent comments', () => {
    const { rerender } = renderPanel({ conversation: secondTurn })

    expect(screen.getByRole('button', { name: 'Send 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()

    return rerender({
      conversation: { turns: secondTurn.turns, unsent: [] }
    }).then(() => {
      expect(screen.getByRole('button', { name: 'Send 0' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
    })
  })

  it('TH-05: says why Send is unavailable while a follow-up waits, and opens no other thread', () => {
    renderPanel({
      conversation: secondTurn,
      phase: 'guiding',
      held: true,
      sendBlock: messages.sendBlocked.followUp
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      messages.sendBlocked.followUp
    )
    expect(screen.getByRole('button', { name: 'Send 1' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: messages.startOver })
    ).toBeDisabled()

    expect(
      screen.getByRole('button', { name: /a bit more than that/ })
    ).toBeDisabled()
  })

  it('TU-08: Start over takes two presses inside the panel and can be backed out of', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel({ conversation: secondTurn })

    await user.click(screen.getByRole('button', { name: messages.startOver }))
    await user.click(
      screen.getByRole('button', { name: messages.startOverKeep })
    )
    expect(emitted()).not.toHaveProperty('startOver')

    await user.click(screen.getByRole('button', { name: messages.startOver }))
    await user.click(
      screen.getByRole('button', { name: messages.startOverConfirm })
    )
    expect(emitted('startOver')).toHaveLength(1)
  })

  it('TU-08: offers no Start over while there is no answered turn', () => {
    renderPanel()

    expect(
      screen.queryByRole('button', { name: messages.startOver })
    ).not.toBeInTheDocument()
  })

  it('BA-04: holds only questions and their actions: no thinking, no waiting row', () => {
    renderPanel({ phase: 'waiting' })

    expect(screen.queryByText(messages.thinking)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: messages.cancel })
    ).not.toBeInTheDocument()
  })

  it('L-05 to L-07, L-10: shows the failure with Retry and keeps Send available', () => {
    renderPanel({
      phase: 'failed',
      failure: { kind: 'provider', detail: 'status 429: Rate limit exceeded' }
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The model provider returned an error (status 429: Rate limit exceeded).'
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send 2' })).toBeEnabled()
  })
})
