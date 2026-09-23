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
  it('offers the way it can still go', async () => {
    renderRow()
    await scrollRow(300, 900, 0)

    expect(screen.getByTestId('card-row-next')).toBeTruthy()
    expect(screen.queryByTestId('card-row-prev')).toBeNull()

    await scrollRow(300, 900, 300)

    expect(screen.getByTestId('card-row-prev')).toBeTruthy()
    expect(screen.getByTestId('card-row-next')).toBeTruthy()
  })

  it('hands focus to the arrow that is left when the other is spent', async () => {
    renderRow()
    await scrollRow(300, 900, 300)
    const forward = screen.getByTestId('card-row-next')
    forward.focus()
    expect(forward).toHaveFocus()

    await scrollRow(300, 900, 600)
    await nextTick()

    expect(screen.queryByTestId('card-row-next')).toBeNull()
    expect(screen.getByTestId('card-row-prev')).toHaveFocus()
  })

  it('hands focus back the other way when the row returns to its start', async () => {
    renderRow()
    await scrollRow(300, 900, 300)
    const back = screen.getByTestId('card-row-prev')
    back.focus()
    expect(back).toHaveFocus()

    await scrollRow(300, 900, 0)
    await nextTick()

    expect(screen.queryByTestId('card-row-prev')).toBeNull()
    expect(screen.getByTestId('card-row-next')).toHaveFocus()
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

  it('keeps focus in the row when it stops overflowing and both arrows go', async () => {
    renderRow()
    await scrollRow(300, 900, 300)
    screen.getByTestId('card-row-next').focus()

    await scrollRow(300, 300, 0)
    await nextTick()

    expect(screen.queryByTestId('card-row-arrows')).toBeNull()
    expect(screen.getByTestId('card-row')).toHaveFocus()
  })

  it('leaves focus alone when the reader is not standing on the arrow', async () => {
    renderRow()
    await scrollRow(300, 900, 300)
    const back = screen.getByTestId('card-row-prev')
    back.focus()

    await scrollRow(300, 900, 600)
    await nextTick()

    expect(back).toHaveFocus()
  })
})
