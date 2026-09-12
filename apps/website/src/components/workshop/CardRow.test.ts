// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import CardRow from './CardRow.vue'

describe('CardRow', () => {
  it('shows paging controls and disables each one at its edge', async () => {
    render(CardRow, {
      slots: { default: '<li>One</li><li>Two</li>' }
    })
    const row = screen.getByRole('list')
    Object.defineProperties(row, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 300 },
      scrollLeft: { configurable: true, writable: true, value: 0 }
    })

    await fireEvent.scroll(row)
    await nextTick()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Scroll back' })
        .disabled
    ).toBe(true)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Scroll forward' })
        .disabled
    ).toBe(false)

    row.scrollLeft = 200
    await fireEvent.scroll(row)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Scroll back' })
        .disabled
    ).toBe(false)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Scroll forward' })
        .disabled
    ).toBe(true)
  })
})
