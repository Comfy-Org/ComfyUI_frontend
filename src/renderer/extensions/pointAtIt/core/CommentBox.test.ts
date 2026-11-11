import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import CommentBox from './CommentBox.vue'
import { settingAddress } from './fakePointHost'
import { messages, sendNowKeyLabel } from './messages'

type Props = ComponentProps<typeof CommentBox>

const width = settingAddress(createNodeLocatorId(null, 5), 'width')
const baseProps: Props = {
  anchor: { x: 260, y: 384, width: 180, height: 18 },
  draft: {
    annotationId: null,
    targets: [width],
    label: 'Empty Latent Image › width',
    comment: ''
  },
  unsentCount: 0
}

async function renderBox(props: Partial<Props> = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const rendered = render(CommentBox, { props: { ...baseProps, ...props } })
  await user.click(screen.getByRole('textbox', { name: messages.commentLabel }))
  return { user, ...rendered }
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

describe('CommentBox', () => {
  it('K-01: Enter adds the question; Shift+Enter makes a new line', async () => {
    const { user, emitted } = await renderBox()

    await user.keyboard('make this{Shift>}{Enter}{/Shift}wider{Enter}')

    expect(emitted('save')).toEqual([['make this\nwider']])
    expect(emitted()).not.toHaveProperty('send')
  })

  it.for(['Meta', 'Control'])(
    'K-02, K-04: %s+Enter asks to add and send right away, and never reaches the app',
    async (modifier) => {
      const seen = enterKeysSeenByTheApp()
      const { user, emitted } = await renderBox()

      await user.keyboard(`make this wider{${modifier}>}{Enter}{/${modifier}}`)

      expect(emitted('send')).toEqual([['make this wider']])
      expect(emitted()).not.toHaveProperty('save')
      expect(seen).toEqual([])
    }
  )

  it('K-03: with nothing typed it sends the questions already in the list', async () => {
    const { user, emitted } = await renderBox({ unsentCount: 2 })

    await user.keyboard('{Meta>}{Enter}{/Meta}')

    expect(emitted('send')).toEqual([['']])
  })

  it('K-03, K-04: with nothing typed and nothing in the list it sends nothing, says so, and the key still stays in the box', async () => {
    const seen = enterKeysSeenByTheApp()
    const { user, emitted } = await renderBox()

    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(emitted()).not.toHaveProperty('send')
    expect(screen.getByRole('status')).toHaveTextContent(messages.nothingToSend)
    expect(seen).toEqual([])
  })

  it('K-07: says why when Send is unavailable, instead of taking the key silently', async () => {
    const { user, emitted } = await renderBox({
      sendBlock: messages.sendBlocked.waiting
    })

    await user.keyboard('make this wider{Meta>}{Enter}{/Meta}')

    expect(emitted()).not.toHaveProperty('send')
    expect(screen.getByRole('status')).toHaveTextContent(
      messages.sendBlocked.waiting
    )
  })

  it('K-05: the hint names both shortcuts with the platform’s modifier', async () => {
    await renderBox()

    expect(
      screen.getByText(
        messages.commentHint(sendNowKeyLabel(navigator.userAgent))
      )
    ).toBeVisible()
    expect(
      messages.commentHint(
        sendNowKeyLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
      )
    ).toContain('Enter to add · ⌘ Enter to send')
    expect(
      messages.commentHint(
        sendNowKeyLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      )
    ).toContain('Enter to add · Ctrl Enter to send')
  })

  it('W-01: a new question is added, an existing one is saved', async () => {
    const { rerender } = await renderBox()
    expect(screen.getByRole('button', { name: messages.add })).toBeDisabled()

    await rerender({
      draft: { ...baseProps.draft, annotationId: 'comment-1', comment: 'wider' }
    })
    expect(screen.getByRole('button', { name: messages.save })).toBeVisible()
  })
})
