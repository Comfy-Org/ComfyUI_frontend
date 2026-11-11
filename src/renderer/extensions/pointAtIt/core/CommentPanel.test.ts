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
  waitingSince: null,
  failure: null,
  thinking: null
}

function renderPanel(props: Partial<ComponentProps<typeof CommentPanel>> = {}) {
  return render(CommentPanel, { props: { ...baseProps, ...props } })
}

describe('CommentPanel', () => {
  it('P-08: its collapse control asks to hide the panel', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel()

    await user.click(screen.getByRole('button', { name: messages.hidePanel }))

    expect(emitted()).toHaveProperty('collapse')
  })

  it('E-03: says which comment’s target is not on screen right now', () => {
    renderPanel()

    expect(screen.getAllByText(messages.notOnScreen)).toHaveLength(1)
  })

  it('TU-03: groups comments by turn, earlier turns collapsed, the current turn open, numbers continuing', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel({ conversation: secondTurn })

    expect(screen.queryByText('make this wider')).not.toBeInTheDocument()
    expect(screen.getByText('a bit more than that')).toBeVisible()
    expect(screen.getByText('3')).toBeVisible()

    await user.click(screen.getByRole('button', { name: messages.showTurn(1) }))
    await user.click(screen.getByText('make this wider'))

    expect(screen.getByText('Turn 1 · 2 questions')).toBeVisible()
    expect(screen.getAllByText(messages.followUpCount(1))).toHaveLength(1)
    expect(emitted('open')).toEqual([['comment-1']])
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

  it('TH-05: says why Send is unavailable while a follow-up waits, and opens no other thread', async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole('button', { name: messages.showTurn(1) }))
    expect(
      screen.getByRole('button', { name: /make this wider/ })
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

  it('TU-10: an earlier turn keeps its thinking in its group', async () => {
    const user = userEvent.setup()
    renderPanel({ conversation: secondTurn })

    await user.click(screen.getByRole('button', { name: messages.showTurn(1) }))

    expect(
      screen.getByText('Checking which node sets the width.')
    ).toBeInTheDocument()
  })

  it('T-01, T-02: shows the end of the thinking while waiting, and the whole of it in place when expanded', async () => {
    const user = userEvent.setup()
    const text = `${'Looking at the workflow. '.repeat(12)}The width is on Empty Latent Image.`
    renderPanel({
      phase: 'waiting',
      waitingSince: Date.now(),
      thinking: { requestId: 'request-1', text, done: false }
    })

    const strip = screen.getByRole('log', { name: messages.thinking })
    expect(strip).toHaveTextContent(/^….*The width is on Empty Latent Image\.$/)
    expect(strip.textContent.length).toBeLessThan(text.length)

    await user.click(
      screen.getByRole('button', { name: messages.showThinking })
    )

    expect(
      screen.getByRole('log', { name: messages.thinking })
    ).toHaveTextContent(text.trim())
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('T-03: after the reply, keeps the thinking behind a collapsed control', async () => {
    const user = userEvent.setup()
    renderPanel({
      thinking: {
        requestId: 'request-1',
        text: 'The width is here.',
        done: true
      }
    })

    expect(screen.queryByText('The width is here.')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: messages.showThinking })
    )

    expect(screen.getByText('The width is here.')).toBeVisible()
  })

  it('T-04: says so when the model returned no thinking', () => {
    renderPanel({ thinking: { requestId: 'request-1', text: '', done: true } })

    expect(screen.getByText(messages.noThinking)).toBeVisible()
  })

  it('T-05: shows nothing about thinking for the scripted agent', () => {
    renderPanel({ phase: 'waiting', waitingSince: Date.now(), thinking: null })

    expect(
      screen.queryByRole('button', { name: messages.showThinking })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(messages.noThinking)).not.toBeInTheDocument()
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
