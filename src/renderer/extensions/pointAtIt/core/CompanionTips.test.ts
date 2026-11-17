import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import type { CardOptions } from './cardOptions'
import CompanionTips from './CompanionTips.vue'
import { messages } from './messages'

type Props = ComponentProps<typeof CompanionTips>

const head = { x: 70, y: 658, width: 60, height: 56 }
const options: CardOptions = {
  context: 'KSampler',
  lead: messages.card.whatThisDoes,
  more: [messages.card.faster, messages.card.settings],
  placeholder: messages.card.placeholderNode('KSampler')
}

function field() {
  return screen.getByRole('textbox', { name: messages.tipsField })
}

/**
 * The test renderer moves what it mounts, which takes the focus the card
 * gives its field when it opens: the layer test of CP-28 covers that, and
 * here the field is clicked first, as the other field tests do.
 */
async function renderCard(props: Partial<Props> = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const rendered = render(CompanionTips, {
    props: { anchor: head, options, ...props }
  })
  await user.click(field())
  return { user, ...rendered }
}

function sendButton() {
  return screen.getByRole('button', { name: messages.tipsSend })
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

describe('CompanionTips: her card', () => {
  it('CP-60: has a short title, what the options are about, the lead question and two more, the field, and a way to point at something', async () => {
    await renderCard()

    expect(screen.getByText(messages.tipsTitle)).toBeVisible()
    expect(
      screen.getByTestId('point-at-it-companion-context')
    ).toHaveTextContent('KSampler')
    for (const option of [options.lead, ...options.more])
      expect(screen.getByRole('button', { name: option })).toBeVisible()
    expect(field()).toHaveAttribute('placeholder', options.placeholder)
    expect(
      screen.getByRole('button', { name: messages.tipsStart })
    ).toBeVisible()
  })

  it('CP-90: the options come first, the lead before the others, and the field with its two buttons last; no context line when nothing is selected', async () => {
    const { rerender } = await renderCard()
    const lead = screen.getByRole('button', { name: options.lead })
    const more = screen.getByRole('button', { name: options.more[0] })
    const follows = (earlier: Element, later: Element) =>
      Boolean(
        earlier.compareDocumentPosition(later) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )

    expect(
      follows(screen.getByTestId('point-at-it-companion-context'), lead)
    ).toBe(true)
    expect(follows(lead, more)).toBe(true)
    expect(follows(more, field())).toBe(true)
    expect(
      follows(field(), screen.getByRole('button', { name: messages.tipsStart }))
    ).toBe(true)
    expect(follows(field(), sendButton())).toBe(true)

    await rerender({ options: { ...options, context: null, more: [] } })

    expect(
      screen.queryByTestId('point-at-it-companion-context')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: options.more[0] })
    ).not.toBeInTheDocument()
  })

  it('CP-60: Enter sends what was typed; Shift+Enter makes a new line and sends nothing', async () => {
    const { user, emitted } = await renderCard()

    await user.keyboard('hello{Shift>}{Enter}{/Shift}there')
    expect(emitted()).not.toHaveProperty('send')
    expect(field()).toHaveValue('hello\nthere')

    await user.keyboard('{Enter}')

    expect(emitted('send')).toEqual([['hello\nthere']])
  })

  it('CP-60: the send button sends it too', async () => {
    const { user, emitted } = await renderCard()

    await user.type(field(), 'what is a sampler?')
    await user.click(sendButton())

    expect(emitted('send')).toEqual([['what is a sampler?']])
  })

  it('CP-60: nothing can be sent while the field is empty or only blank', async () => {
    const { user, emitted } = await renderCard()

    expect(sendButton()).toBeDisabled()
    await user.keyboard('{Enter}')
    await user.keyboard('   {Enter}')

    expect(sendButton()).toBeDisabled()
    expect(emitted()).not.toHaveProperty('send')
  })

  it.for(['Meta', 'Control'])(
    'CP-60: %s+Enter sends too and never reaches the app, whose shortcut would run the workflow',
    async (modifier) => {
      const seen = enterKeysSeenByTheApp()
      const { user, emitted } = await renderCard()

      await user.keyboard(`hi{${modifier}>}{Enter}{/${modifier}}`)

      expect(emitted('send')).toEqual([['hi']])
      expect(seen).toEqual([])
    }
  )

  it('CP-64: the letter that starts asking is typed like any other in the field', async () => {
    const { user, emitted } = await renderCard()

    await user.keyboard('quick question')

    expect(field()).toHaveValue('quick question')
    expect(emitted()).not.toHaveProperty('point')
  })

  it.for([options.lead, options.more[0]])(
    'CP-62: the option "%s" is sent at once, and the field is left alone',
    async (option) => {
      const { user, emitted } = await renderCard()

      await user.click(screen.getByRole('button', { name: option }))

      expect(emitted('send')).toEqual([[option]])
      expect(field()).toHaveValue('')
    }
  )

  it('CP-30: pointing at something asks for that, and sends nothing', async () => {
    const { user, emitted } = await renderCard()

    await user.click(screen.getByRole('button', { name: messages.tipsStart }))

    expect(emitted('point')).toHaveLength(1)
    expect(emitted()).not.toHaveProperty('send')
  })

  it('CP-29: Esc, the close button and a press anywhere else close it; a press inside does not', async () => {
    const { user, emitted } = await renderCard()

    await user.click(field())
    expect(emitted()).not.toHaveProperty('close')

    await user.keyboard('{Escape}')
    expect(emitted('close')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: messages.close }))
    expect(emitted('close')).toHaveLength(2)

    await user.click(document.body)
    expect(emitted('close')).toEqual([['key'], ['button'], ['outside']])
  })

  it('CP-77: the button for pointing is named by its words, and its key is in its tooltip and its shortcut', async () => {
    await renderCard()
    const point = screen.getByRole('button', { name: messages.tipsStart })

    expect(point).toHaveAttribute(
      'title',
      `${messages.tipsStart} (${messages.tipsStartKey})`
    )
    expect(point).toHaveAttribute('aria-keyshortcuts', 'q')
  })

  it('CP-68: the field has the keyboard only when the card takes focus, and takes it when it is told to', async () => {
    const { rerender } = render(CompanionTips, {
      props: { anchor: head, options }
    })
    expect(field()).not.toHaveFocus()

    await rerender({ takesFocus: true })

    expect(field()).toHaveFocus()
  })

  it('CP-70: tells the layer when the pointer is on the card and when it leaves', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { emitted } = render(CompanionTips, {
      props: { anchor: head, options }
    })
    const card = screen.getByRole('dialog')

    await user.hover(card)
    expect(emitted('enter')).toHaveLength(1)
    expect(emitted()).not.toHaveProperty('leave')

    await user.unhover(card)
    expect(emitted('leave')).toHaveLength(1)
  })

  it('CP-71: a press on the card, or the focus coming into it, says the person is using it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { emitted } = render(CompanionTips, {
      props: { anchor: head, options }
    })

    await user.click(screen.getByText(messages.tipsTitle))
    expect(emitted('engage')).toHaveLength(1)

    field().focus()
    expect(emitted('engage')).toHaveLength(2)
    expect(emitted()).not.toHaveProperty('close')
  })

  it('CP-69: a press on her is neither a press on the card nor a press elsewhere: her click decides', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { emitted } = render(CompanionTips, {
      props: { anchor: head, options }
    })
    const her = document.createElement('button')
    her.setAttribute('data-point-at-it-companion-button', '')
    document.body.append(her)
    onTestFinished(() => her.remove())

    await user.click(her)

    expect(emitted()).not.toHaveProperty('engage')
    expect(emitted()).not.toHaveProperty('close')
  })
})
