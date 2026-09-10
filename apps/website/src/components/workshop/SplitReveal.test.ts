// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SplitReveal from './SplitReveal.vue'

describe('SplitReveal', () => {
  it('reads as the sentence it was given', () => {
    render(SplitReveal, { props: { text: 'Run any model, no setup' } })
    expect(screen.getByTestId('split-reveal').textContent.trim()).toBe(
      'Run any model, no setup'
    )
  })
})
