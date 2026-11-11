import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import FollowUpField from './FollowUpField.vue'
import { messages } from './messages'

type Props = ComponentProps<typeof FollowUpField>

function waiting(): Props['activity'] {
  return {
    status: 'waiting',
    requestId: 'request-3',
    text: 'a bit more than that',
    startedAt: Date.now() - 4200
  }
}
const failed: Props['activity'] = {
  status: 'failed',
  text: 'a bit more than that',
  failure: { kind: 'provider', detail: 'status 429' }
}

function renderField(props: Partial<Props> = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const rendered = render(FollowUpField, {
    props: { activity: null, thinking: null, ...props }
  })
  return { user, ...rendered }
}

function field() {
  return screen.getByRole('textbox', { name: messages.followUpLabel })
}

function enterKeysSeenByTheApp() {
  const seen: KeyboardEvent[] = []
  function listen(event: KeyboardEvent) {
    if (event.key === 'Enter') seen.push(event)
  }
  window.addEventListener('keydown', listen)
  onTestFinished(() => window.removeEventListener('keydown', listen))
  return seen
}

describe('FollowUpField', () => {
  it('TH-01: appearing does not move keyboard focus into the field', () => {
    renderField()

    expect(field()).not.toHaveFocus()
  })

  it('TH-03: Enter sends what was typed; Shift+Enter makes a new line; empty text sends nothing', async () => {
    const { user, emitted } = renderField()

    await user.click(field())
    await user.keyboard('{Enter}')
    expect(emitted()).not.toHaveProperty('send')

    await user.keyboard('why{Shift>}{Enter}{/Shift}1280?{Enter}')

    expect(emitted('send')).toEqual([['why\n1280?']])
  })

  it.for(['Meta', 'Control'])(
    'K-04, K-06: %s+Enter sends too and never reaches the app',
    async (modifier) => {
      const seen = enterKeysSeenByTheApp()
      const { user, emitted } = renderField()

      await user.click(field())
      await user.keyboard(`why?{${modifier}>}{Enter}{/${modifier}}`)

      expect(emitted('send')).toEqual([['why?']])
      expect(seen).toEqual([])
    }
  )

  it('K-04: an empty field still keeps Ctrl+Enter and Ctrl+Shift+Enter from the app', async () => {
    const seen = enterKeysSeenByTheApp()
    const { user, emitted } = renderField()

    await user.click(field())
    await user.keyboard('{Control>}{Enter}{Shift>}{Enter}{/Shift}{/Control}')

    expect(emitted()).not.toHaveProperty('send')
    expect(seen).toEqual([])
    expect(field()).toHaveValue('')
  })

  it('TH-04: while waiting it shows the sent text, the elapsed time and the live thinking, with Cancel and no field', async () => {
    const { user, emitted } = renderField({
      activity: waiting(),
      thinking: {
        requestId: 'request-3',
        text: 'Looking at the width setting.',
        done: false
      }
    })

    expect(screen.getByText('a bit more than that')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      messages.followUpWaiting(4)
    )
    expect(
      screen.getByRole('log', { name: messages.thinking })
    ).toHaveTextContent('Looking at the width setting.')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: messages.cancel }))
    expect(emitted('cancel')).toHaveLength(1)
  })

  it('TH-04: shows no thinking that belongs to another request', () => {
    renderField({
      activity: waiting(),
      thinking: { requestId: 'request-1', text: 'An earlier turn.', done: true }
    })

    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  it('TH-08: after a cancel the typed text is back in the field', async () => {
    const { user, rerender } = renderField()
    await user.click(field())
    await user.keyboard('a bit more than that{Enter}')

    await rerender({ activity: waiting() })
    await rerender({ activity: null })

    expect(field()).toHaveValue('a bit more than that')
  })

  it('TH-09: a failure shows its own message with Retry and keeps the typed text', async () => {
    const { user, emitted } = renderField({ activity: failed })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The model provider returned an error (status 429).'
    )
    expect(field()).toHaveValue('a bit more than that')

    await user.click(screen.getByRole('button', { name: messages.retry }))
    expect(emitted('retry')).toHaveLength(1)
  })
})
