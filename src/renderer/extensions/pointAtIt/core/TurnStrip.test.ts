import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import { messages } from './messages'
import { turnStripItems } from './turnGrouping'
import TurnStrip from './TurnStrip.vue'
import { emptyConversation, reduceConversation } from './turns'
import type { Conversation } from './turns'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')
const LEAVE_MS = 400

function withTurn(
  state: Conversation,
  number: number,
  questions: string[] = [`question ${number}`]
): Conversation {
  const saved = questions.reduce(
    (current, text, index) =>
      reduceConversation(current, {
        type: 'saved',
        id: `comment-${number}-${index + 1}`,
        targets: [width],
        label: 'Empty Latent Image › width',
        comment: text
      }),
    state
  )
  return reduceConversation(saved, {
    type: 'answered',
    turnId: `turn-${number}`,
    sentAt: Date.UTC(2026, 10, 11, 14, number),
    steps: [
      {
        annotationId: `comment-${number}-1`,
        text: `Change width to ${1000 + number}.`,
        target: width,
        waitFor: null,
        offerEdit: null,
        problems: []
      }
    ],
    thinking: `thinking ${number}`
  })
}

function conversationOf(
  turnCount: number,
  multi: Record<number, string[]> = {}
): Conversation {
  return Array.from({ length: turnCount }).reduce<Conversation>(
    (state, _, index) => withTurn(state, index + 1, multi[index + 1]),
    emptyConversation
  )
}

function renderStrip(
  conversation: Conversation,
  props: Partial<ComponentProps<typeof TurnStrip>> = {}
) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const view = render(TurnStrip, {
    props: {
      items: turnStripItems(conversation, { visibleDots: 8, barSize: 5 }),
      shownTurnId: null,
      disabled: false,
      ...props
    }
  })
  return { user, ...view }
}

function stripButtons() {
  return within(
    screen.getByRole('list', { name: messages.turnStripLabel })
  ).getAllByRole('button')
}

function dot(number: number, total: number, question = `question ${number}`) {
  return screen.getByRole('button', {
    name: messages.turnDotLabel(number, total, question)
  })
}

describe('TurnStrip: dots', () => {
  it('TS-13: one dot per past turn, oldest first, and the current dot last', () => {
    renderStrip(conversationOf(3))

    expect(
      stripButtons().map((button) => button.getAttribute('aria-label'))
    ).toEqual([
      'Turn 1 of 3: question 1',
      'Turn 2 of 3: question 2',
      'Turn 3 of 3: question 3',
      messages.nextTurnLabel(0)
    ])
  })

  it('TS-14: shows no card until a dot is hovered or focused', () => {
    renderStrip(conversationOf(2))

    expect(
      screen.queryByTestId('point-at-it-turn-card')
    ).not.toBeInTheDocument()
  })

  it('TS-14: hovering a dot shows its card: the question, the start of the answer, the place and the time', async () => {
    const { user } = renderStrip(conversationOf(3))

    await user.hover(dot(2, 3))

    const card = within(screen.getByTestId('point-at-it-turn-card'))
    expect(card.getByText('question 2')).toBeVisible()
    expect(card.getByText('Change width to 1002.')).toBeVisible()
    expect(card.getByText('turn 2 of 3')).toBeVisible()
    expect(card.getByText(/\d{1,2}[:.]\d{2}/)).toBeVisible()
    expect(screen.getAllByTestId('point-at-it-turn-card')).toHaveLength(1)
  })

  it('TS-14: focusing a dot from the keyboard shows the same card', async () => {
    const { user } = renderStrip(conversationOf(3))

    await user.tab()

    expect(dot(1, 3)).toHaveFocus()
    expect(
      within(screen.getByTestId('point-at-it-turn-card')).getByText(
        'question 1'
      )
    ).toBeVisible()
  })

  it('TS-15: the card stays open while the pointer moves from the dot into it, and closes once the pointer leaves both', async () => {
    const { user } = renderStrip(conversationOf(3))

    await user.hover(dot(2, 3))
    await user.hover(screen.getByText('Change width to 1002.'))
    await vi.advanceTimersByTimeAsync(LEAVE_MS)
    expect(screen.getByTestId('point-at-it-turn-card')).toBeInTheDocument()

    await user.unhover(screen.getByText('Change width to 1002.'))
    await vi.advanceTimersByTimeAsync(LEAVE_MS)
    expect(
      screen.queryByTestId('point-at-it-turn-card')
    ).not.toBeInTheDocument()
  })

  it('TS-16: clicking a dot opens that turn’s first question', async () => {
    const { user, emitted } = renderStrip(conversationOf(3))

    await user.click(dot(2, 3))

    expect(emitted('open')).toEqual([['comment-2-1']])
  })

  it('TS-16: while opening is not possible a dot and its card open nothing', async () => {
    const { user, emitted } = renderStrip(conversationOf(3), {
      disabled: true
    })

    await user.click(dot(2, 3))
    await user.hover(dot(2, 3))
    await user.click(
      within(screen.getByTestId('point-at-it-turn-card')).getByRole('button', {
        name: 'question 2'
      })
    )

    expect(emitted()).not.toHaveProperty('open')
  })

  it('TS-17: a turn with several questions lists them, and each row opens its own thread', async () => {
    const { user, emitted } = renderStrip(
      conversationOf(2, {
        2: ['make this wider', 'what is this?', 'and taller?']
      })
    )

    await user.hover(dot(2, 2, 'make this wider'))
    const card = within(screen.getByTestId('point-at-it-turn-card'))

    expect(card.getByText('+2 more questions')).toBeVisible()
    expect(card.getAllByRole('button')).toHaveLength(3)

    await user.click(card.getByRole('button', { name: 'what is this?' }))
    await user.click(card.getByRole('button', { name: 'and taller?' }))

    expect(emitted('open')).toEqual([['comment-2-2'], ['comment-2-3']])
  })

  it('TS-18: an earlier turn’s thinking is behind a closed disclosure on its card', async () => {
    const { user } = renderStrip(conversationOf(2))

    await user.hover(dot(1, 2))
    const card = within(screen.getByTestId('point-at-it-turn-card'))

    expect(card.getByText('thinking 1')).not.toBeVisible()
    await user.click(card.getByText(messages.thinking))
    expect(card.getByText('thinking 1')).toBeVisible()
  })

  it('TS-19: marks the turn whose answer is on screen as current', () => {
    renderStrip(conversationOf(3), { shownTurnId: 'turn-2' })

    expect(dot(2, 3)).toHaveAttribute('aria-current', 'true')
    expect(dot(1, 3)).not.toHaveAttribute('aria-current')
    expect(dot(3, 3)).not.toHaveAttribute('aria-current')
  })
})

describe('TurnStrip: the current dot', () => {
  it('TS-20: names the next turn and how many questions wait, and asks for the panel when pressed', async () => {
    const waiting = reduceConversation(conversationOf(2), {
      type: 'saved',
      id: 'comment-9',
      targets: [width],
      label: 'Empty Latent Image › width',
      comment: 'and taller?'
    })
    const { user, emitted } = renderStrip(waiting)

    await user.click(
      screen.getByRole('button', { name: messages.nextTurnLabel(1) })
    )

    expect(emitted('openPanel')).toHaveLength(1)
    expect(emitted()).not.toHaveProperty('open')
  })
})

describe('TurnStrip: bars', () => {
  const twelve = conversationOf(12)

  function bar(first: number, last: number, title: string) {
    return screen.getByRole('button', {
      name: messages.turnBarLabel(first, last, title)
    })
  }

  it('TS-21: turns past the dot limit fold into bars above the dots', () => {
    renderStrip(twelve)

    const names = stripButtons().map((button) =>
      button.getAttribute('aria-label')
    )

    expect(names.slice(0, 2)).toEqual([
      'Turns 1 to 4: question 1',
      'Turn 5 of 12: question 5'
    ])
    expect(names).toHaveLength(1 + 8 + 1)
  })

  it('TS-22: hovering a bar shows its title, time range and count, then a row per turn with its time and question', async () => {
    const { user } = renderStrip(twelve)

    await user.hover(bar(1, 4, 'question 1'))

    const card = within(screen.getByTestId('point-at-it-bar-card'))
    expect(card.getByText(/· 4 turns$/)).toBeVisible()
    const rows = within(
      card.getByRole('list', { name: messages.turnsOfBar })
    ).getAllByRole('button')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/\d{1,2}[:.]\d{2}.*question 1$/),
      expect.stringMatching(/question 2$/),
      expect.stringMatching(/question 3$/),
      expect.stringMatching(/question 4$/)
    ])
  })

  it('TS-22: focusing a bar from the keyboard shows the same card, and its rows come next in the tab order', async () => {
    const { user, emitted } = renderStrip(twelve)

    await user.tab()
    expect(bar(1, 4, 'question 1')).toHaveFocus()
    expect(screen.getByTestId('point-at-it-bar-card')).toBeInTheDocument()

    await user.tab()
    await user.tab()
    await user.keyboard('{Enter}')

    expect(emitted('open')).toEqual([['comment-2-1']])
  })

  it('TS-23: clicking a row of a bar opens that turn’s first question', async () => {
    const { user, emitted } = renderStrip(twelve)

    await user.hover(bar(1, 4, 'question 1'))
    await user.click(
      screen.getByRole('button', { name: 'Turn 3 of 12: question 3' })
    )

    expect(emitted('open')).toEqual([['comment-3-1']])
  })

  it('TS-19: marks a bar as current when the shown turn is one of its turns', () => {
    renderStrip(twelve, { shownTurnId: 'turn-3' })

    expect(bar(1, 4, 'question 1')).toHaveAttribute('aria-current', 'true')
    expect(dot(5, 12)).not.toHaveAttribute('aria-current')
  })
})
