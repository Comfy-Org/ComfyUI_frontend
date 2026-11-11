import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import AnnotationTray from './AnnotationTray.vue'
import { settingAddress } from './fakePointHost'
import { messages } from './messages'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')
const pinned = { x: 260, y: 384, width: 180, height: 18 }

const baseProps: ComponentProps<typeof AnnotationTray> = {
  annotations: [
    {
      id: 'comment-1',
      targets: [width],
      label: 'Empty Latent Image › width',
      comment: 'make this wider'
    },
    {
      id: 'comment-2',
      targets: [width],
      label: 'Save Image',
      comment: 'what is this?'
    }
  ],
  pins: [
    { id: 'comment-1', number: 1, rect: pinned, missing: false },
    { id: 'comment-2', number: 2, rect: null, missing: false }
  ],
  phase: 'idle',
  waitingSince: null,
  failure: null,
  thinking: null
}

function renderTray(
  props: Partial<ComponentProps<typeof AnnotationTray>> = {}
) {
  return render(AnnotationTray, { props: { ...baseProps, ...props } })
}

describe('AnnotationTray', () => {
  it('U-05, U-06: collapses the list to a count, keeps Annotate, Clear and Send, and stays collapsed through the mode', async () => {
    const user = userEvent.setup()
    const { rerender } = renderTray()

    await user.click(
      screen.getByRole('button', { name: messages.hideComments })
    )

    expect(screen.queryByText('make this wider')).not.toBeInTheDocument()
    expect(screen.getByText('2 comments')).toBeVisible()
    expect(screen.getByRole('button', { name: /Annotate/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send 2' })).toBeEnabled()

    await rerender({ phase: 'annotating' })
    await rerender({ phase: 'idle' })
    expect(screen.queryByText('make this wider')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: messages.showComments })
    )
    expect(screen.getByText('make this wider')).toBeVisible()
  })

  it('E-03: says which comment’s target is not on screen right now', () => {
    renderTray()

    expect(screen.getAllByText(messages.notOnScreen)).toHaveLength(1)
  })

  it('T-01, T-02: shows the end of the thinking while waiting, and the whole of it in place when expanded', async () => {
    const user = userEvent.setup()
    const text = `${'Looking at the workflow. '.repeat(12)}The width is on Empty Latent Image.`
    renderTray({
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
    renderTray({
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
    renderTray({ thinking: { requestId: 'request-1', text: '', done: true } })

    expect(screen.getByText(messages.noThinking)).toBeVisible()
  })

  it('T-05: shows nothing about thinking for the scripted agent', () => {
    renderTray({ phase: 'waiting', waitingSince: Date.now(), thinking: null })

    expect(
      screen.queryByRole('button', { name: messages.showThinking })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(messages.noThinking)).not.toBeInTheDocument()
  })

  it('L-05 to L-07, L-10: shows the failure with Retry and keeps Send available', () => {
    renderTray({
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
