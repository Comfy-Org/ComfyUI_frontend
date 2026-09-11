// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SplitReveal from './SplitReveal.vue'

describe('SplitReveal', () => {
  it('updates the visible heading when its text changes', async () => {
    const { rerender } = render(SplitReveal, {
      props: { text: 'First heading' }
    })
    await rerender({ text: 'Second heading with more words' })
    expect(screen.getByTestId('split-reveal').textContent).toBe(
      'Second heading with more words'
    )
    expect(screen.queryByText('First')).toBeNull()
  })

  it('reads as the sentence it was given', () => {
    render(SplitReveal, { props: { text: 'Run any model, no setup' } })
    expect(screen.getByTestId('split-reveal').textContent.trim()).toBe(
      'Run any model, no setup'
    )
  })
})
