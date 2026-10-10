import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import CardRow from './CardRow.vue'

/**
 * A row only knows where it stands from its own scroll metrics, which a DOM
 * without layout reports as zero. Describing them is what gives the row cards
 * wider than itself.
 */
function scrollRow(width: number, content: number, left: number) {
  const row = screen.getByTestId('card-row')
  for (const [name, value] of [
    ['clientWidth', width],
    ['scrollWidth', content]
  ] as const)
    Object.defineProperty(row, name, { value, configurable: true })
  row.scrollLeft = left
  return fireEvent.scroll(row)
}

function renderRow() {
  return render(CardRow, { slots: { default: '<li>A card</li>' } })
}

describe('CardRow', () => {
  it('marks the way it cannot go rather than taking the arrow away', async () => {
    renderRow()
    await scrollRow(300, 900, 0)

    expect(screen.getByTestId('card-row-prev')).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByTestId('card-row-next')).not.toHaveAttribute(
      'aria-disabled'
    )

    await scrollRow(300, 900, 300)

    expect([
      screen.getByTestId('card-row-prev').getAttribute('aria-disabled'),
      screen.getByTestId('card-row-next').getAttribute('aria-disabled')
    ]).toEqual([null, null])
  })

  it('pages by most of a screenful, so a card stays to hold on to', async () => {
    renderRow()
    await scrollRow(300, 900, 300)
    const scrollBy = vi.fn()
    screen.getByTestId('card-row').scrollBy = scrollBy

    const user = userEvent.setup()
    await user.click(screen.getByTestId('card-row-next'))
    await user.click(screen.getByTestId('card-row-prev'))

    expect(scrollBy.mock.calls).toEqual([
      [{ left: 240, behavior: 'smooth' }],
      [{ left: -240, behavior: 'smooth' }]
    ])
  })

  it('does not page past an end the row is already resting on', async () => {
    renderRow()
    await scrollRow(300, 900, 0)
    const scrollBy = vi.fn()
    screen.getByTestId('card-row').scrollBy = scrollBy

    await userEvent.setup().click(screen.getByTestId('card-row-prev'))

    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('leaves a spent arrow reachable by keyboard, and refuses it there too', async () => {
    renderRow()
    await scrollRow(300, 900, 0)
    const back = screen.getByTestId('card-row-prev')
    const scrollBy = vi.fn()
    screen.getByTestId('card-row').scrollBy = scrollBy

    back.focus()
    await userEvent.setup().keyboard('{Enter}')

    expect([
      back.tabIndex,
      back.hasAttribute('disabled'),
      back.getAttribute('aria-disabled')
    ]).toEqual([0, false, 'true'])
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('keeps the reader on the arrow they are standing on when it is spent', async () => {
    renderRow()
    await scrollRow(300, 900, 300)
    const forward = screen.getByTestId('card-row-next')
    forward.focus()

    await scrollRow(300, 900, 600)
    await nextTick()

    expect(forward).toHaveFocus()
  })

  it('keeps focus in the row when it stops overflowing and the arrows go', async () => {
    renderRow()
    await scrollRow(300, 900, 300)
    screen.getByTestId('card-row-next').focus()

    await scrollRow(300, 300, 0)
    await nextTick()

    expect(screen.queryByTestId('card-row-arrows')).toBeNull()
    expect(screen.getByTestId('card-row')).toHaveFocus()
  })

  it('leaves focus alone when the reader is not standing on an arrow', async () => {
    renderRow()
    await scrollRow(300, 900, 300)
    const row = screen.getByTestId('card-row')
    row.focus()

    await scrollRow(300, 300, 0)
    await nextTick()

    expect(row).toHaveFocus()
  })

  it('does not take focus off a card when the row stops overflowing', async () => {
    render(CardRow, {
      slots: { default: '<li><a href="#card">A card</a></li>' }
    })
    await scrollRow(300, 900, 300)
    const card = screen.getByRole('link', { name: 'A card' })
    card.focus()

    await scrollRow(300, 300, 0)
    await nextTick()

    expect(card).toHaveFocus()
  })
})
