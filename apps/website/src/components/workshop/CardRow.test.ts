import { fireEvent, render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import CardRow from './CardRow.vue'

describe('CardRow', () => {
  it('offers each arrow only while that side has somewhere to go', async () => {
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
    expect(screen.queryByRole('button', { name: 'Scroll back' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Scroll forward' })).toBeTruthy()

    row.scrollLeft = 200
    await fireEvent.scroll(row)
    await nextTick()
    expect(screen.getByRole('button', { name: 'Scroll back' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Scroll forward' })).toBeNull()
  })

  it('carries no arrows while every card already fits', async () => {
    render(CardRow, { slots: { default: '<li>Only</li>' } })
    const row = screen.getByRole('list')
    Object.defineProperties(row, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 300 },
      scrollLeft: { configurable: true, writable: true, value: 0 }
    })

    await fireEvent.scroll(row)
    await nextTick()
    expect(screen.queryByTestId('card-row-arrows')).toBeNull()
  })
})
