import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { pointConfig } from './config'
import type { PointConfig } from './config'
import { createFakePointHost } from './fakePointHost'
import { messages } from './messages'
import PointLayer from './PointLayer.vue'
import { HOVER_MENU_CLOSE_MS, HOVER_MENU_OPEN_MS } from './useCompanionMenu'

const config: PointConfig = {
  ...pointConfig,
  agent: 'scripted',
  companion: true,
  scripted: { replyDelayMs: 500, wrongTarget: false }
}

type User = ReturnType<typeof userEvent.setup>

function renderLayer(layerConfig: PointConfig = config) {
  document.body.innerHTML = '<button>Elsewhere</button>'
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(PointLayer, {
    props: { host: createFakePointHost(), config: layerConfig }
  })
  return { user }
}

const her = () => screen.getByTestId('point-at-it-companion-button')
const card = () => screen.queryByTestId('point-at-it-companion-tips')
const cardElement = () => screen.getByTestId('point-at-it-companion-tips')
const field = () => screen.getByRole('textbox', { name: messages.tipsField })
const elsewhere = () => screen.getByRole('button', { name: 'Elsewhere' })

// The setup's fake clock also follows real time (it jumped 20 ms or more
// ahead during a test, more under load), which breaks checks of "not before"
// and "at" a set time. These tests drive the clock by hand only.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
})

/** The pointer comes onto her and rests there until her card opens. */
async function peek(user: User) {
  await user.hover(her())
  await vi.advanceTimersByTimeAsync(HOVER_MENU_OPEN_MS)
}

describe('PointLayer: her card as a peek', () => {
  it('CP-67: resting on her opens her card at the set time and not before', async () => {
    const { user } = renderLayer()

    await user.hover(her())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_OPEN_MS - 1)
    expect(card()).not.toBeInTheDocument()
    expect(her()).toHaveAttribute('aria-expanded', 'false')

    await vi.advanceTimersByTimeAsync(1)

    expect(card()).toBeInTheDocument()
    expect(her()).toHaveAttribute('aria-expanded', 'true')
  })

  it('CP-67: leaving her before that opens nothing', async () => {
    const { user } = renderLayer()
    await user.hover(her())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_OPEN_MS - 100)

    await user.unhover(her())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_OPEN_MS * 2)

    expect(card()).not.toBeInTheDocument()
  })

  it('CP-68: a peek leaves the field alone, and the key still starts pointing', async () => {
    const { user } = renderLayer()
    await peek(user)

    expect(card()).toBeInTheDocument()
    expect(field()).not.toHaveFocus()

    await user.keyboard('q')

    expect(card()).not.toBeInTheDocument()
    expect(screen.getByTestId('point-at-it-capture')).toBeInTheDocument()
  })

  it('CP-69: a click on her keeps a peek and gives the field the keyboard; a click after that closes it', async () => {
    const { user } = renderLayer()
    await peek(user)

    await user.click(her())

    expect(card()).toBeInTheDocument()
    expect(field()).toHaveFocus()
    expect(her()).not.toHaveFocus()
    await user.unhover(her())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_CLOSE_MS * 3)
    expect(card()).toBeInTheDocument()

    await user.click(her())

    expect(card()).not.toBeInTheDocument()
    expect(her()).toHaveAttribute('aria-expanded', 'false')
  })

  it('CP-70: a peek closes at the set time after the pointer has left her', async () => {
    const { user } = renderLayer()
    await peek(user)

    await user.unhover(her())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_CLOSE_MS - 1)
    expect(card()).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)

    expect(card()).not.toBeInTheDocument()
  })

  it('CP-70: moving from her onto the card keeps it, and leaving the card closes it at the set time', async () => {
    const { user } = renderLayer()
    await peek(user)

    await user.unhover(her())
    await user.hover(cardElement())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_CLOSE_MS * 3)
    expect(card()).toBeInTheDocument()

    await user.unhover(cardElement())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_CLOSE_MS - 1)
    expect(card()).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)

    expect(card()).not.toBeInTheDocument()
  })

  it.for<{ how: string; use: (user: User) => Promise<void> }>([
    {
      how: 'a press inside it',
      use: (user) => user.click(screen.getByText(messages.tipsTitle))
    },
    {
      how: 'the focus coming into its field',
      // user-event keeps a bare `focus()` from reaching listeners, so the focus comes in by Tab.
      use: async (user) => {
        for (let tabs = 0; tabs < 20 && !field().matches(':focus'); tabs++)
          await user.tab()
        expect(field()).toHaveFocus()
      }
    },
    {
      how: 'text typed in its field',
      use: async (user) => {
        await user.click(field())
        await user.keyboard('hi')
      }
    }
  ])('CP-71: $how keeps a peek, wherever the pointer goes', async ({ use }) => {
    const { user } = renderLayer()
    await peek(user)

    await use(user)
    await user.unhover(her())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_CLOSE_MS * 5)

    expect(card()).toBeInTheDocument()
  })

  it('CP-72: Esc closes a peek, and so does a press anywhere else', async () => {
    const { user } = renderLayer()
    await peek(user)

    await user.keyboard('{Escape}')
    expect(card()).not.toBeInTheDocument()
    expect(her()).toHaveAttribute('aria-expanded', 'false')

    await user.unhover(her())
    await peek(user)
    expect(card()).toBeInTheDocument()
    await user.click(elsewhere())

    expect(card()).not.toBeInTheDocument()
  })

  it('CP-72: closing forgets the pin, so the next peek is a peek again', async () => {
    const { user } = renderLayer()
    await user.click(her())
    expect(field()).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(card()).not.toBeInTheDocument()

    await user.unhover(her())
    await peek(user)
    expect(card()).toBeInTheDocument()
    expect(field()).not.toHaveFocus()
    await user.unhover(her())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_CLOSE_MS)

    expect(card()).not.toBeInTheDocument()
  })

  it.for([
    { pointerType: 'touch', opens: false },
    { pointerType: 'pen', opens: true }
  ])(
    'CP-73: a $pointerType pointer resting on her opens a peek: $opens',
    async ({ pointerType, opens }) => {
      renderLayer()

      // oxlint-disable-next-line testing-library/prefer-user-event -- user-event cannot set the pointer type
      await fireEvent.pointerEnter(her(), { pointerType })
      await vi.advanceTimersByTimeAsync(HOVER_MENU_OPEN_MS * 2)

      expect(card() !== null).toBe(opens)
    }
  )

  it('CP-73: a tap on her still opens it pinned, with the field focused', async () => {
    renderLayer()

    // oxlint-disable-next-line testing-library/prefer-user-event -- user-event cannot set the pointer type
    await fireEvent.click(her(), { detail: 1 })

    expect(card()).toBeInTheDocument()
    expect(field()).toHaveFocus()
  })
})

describe('PointLayer: when her card is not on offer', () => {
  it('CP-74: she opens nothing while Ask is on', async () => {
    const { user } = renderLayer()
    await user.keyboard('q')
    expect(screen.getByTestId('point-at-it-capture')).toBeInTheDocument()

    await peek(user)

    expect(card()).not.toBeInTheDocument()
  })

  it('CP-74: she opens nothing while a request waits, or while an answer is on screen', async () => {
    const { user } = renderLayer({
      ...config,
      scripted: { replyDelayMs: 5000, wrongTarget: false }
    })
    await user.click(her())
    await user.keyboard('hi{Enter}')
    await user.unhover(her())

    await peek(user)
    expect(card()).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(5000)
    expect(screen.getByTestId('point-at-it-bubble')).toBeInTheDocument()
    await user.unhover(her())
    await peek(user)

    expect(card()).not.toBeInTheDocument()
  })

  it('CP-75: while her card is on offer she has no tooltip to stack on it, and is still named; Ask keeps its tooltips', async () => {
    const { user } = renderLayer()

    expect(her()).not.toHaveAttribute('title')
    expect(screen.getByRole('button', { name: messages.tipsLabel })).toBe(her())

    await user.keyboard('q')

    expect(her()).toHaveAttribute('title', messages.annotateTooltip)
    expect(screen.getByRole('button', { name: messages.annotate })).toBe(her())
  })
})

describe('PointLayer: with the hover menu off', () => {
  const off: PointConfig = { ...config, hoverMenu: false }

  it('CP-76: she keeps her tooltip, and resting on her opens nothing', async () => {
    const { user } = renderLayer(off)
    expect(her()).toHaveAttribute('title', messages.tipsTooltip)

    await peek(user)
    await vi.advanceTimersByTimeAsync(HOVER_MENU_OPEN_MS)

    expect(card()).not.toBeInTheDocument()
  })

  it('CP-76: a click opens it pinned, with the field focused, and a click after that closes it', async () => {
    const { user } = renderLayer(off)

    await user.click(her())
    expect(card()).toBeInTheDocument()
    expect(field()).toHaveFocus()
    await user.unhover(her())
    await vi.advanceTimersByTimeAsync(HOVER_MENU_CLOSE_MS * 3)
    expect(card()).toBeInTheDocument()

    await user.click(her())

    expect(card()).not.toBeInTheDocument()
  })
})

describe('PointLayer: what her card shows and where the keyboard goes', () => {
  it('CP-77: the button for pointing has its key in its tooltip', async () => {
    const { user } = renderLayer()

    await user.click(her())

    const point = within(cardElement()).getByRole('button', {
      name: messages.tipsStart
    })
    expect(point).toHaveAttribute(
      'title',
      `${messages.tipsStart} (${messages.tipsStartKey})`
    )
  })

  it('CP-78: Enter on her opens it pinned with the field focused, and Esc or the close button hand the keyboard back to her', async () => {
    const { user } = renderLayer()
    elsewhere().focus()
    await user.tab()
    expect(her()).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(card()).toBeInTheDocument()
    expect(field()).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(card()).not.toBeInTheDocument()
    expect(her()).toHaveFocus()

    await user.keyboard('{Enter}')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: messages.close
      })
    )

    expect(card()).not.toBeInTheDocument()
    expect(her()).toHaveFocus()
  })

  it('CP-78: a press elsewhere does not give her the keyboard, and a card opened by the pointer never does', async () => {
    const { user } = renderLayer()
    elsewhere().focus()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(card()).toBeInTheDocument()

    await user.click(elsewhere())

    expect(card()).not.toBeInTheDocument()
    expect(elsewhere()).toHaveFocus()

    await peek(user)
    await user.keyboard('{Escape}')
    expect(card()).not.toBeInTheDocument()
    expect(her()).not.toHaveFocus()

    await user.unhover(her())
    await user.click(her())
    await user.keyboard('{Escape}')
    expect(card()).not.toBeInTheDocument()
    expect(her()).not.toHaveFocus()
  })
})
