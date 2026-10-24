import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SpokenText from './SpokenText.vue'

describe('SpokenText', () => {
  it('preserves whitespace and newlines while staggering words', () => {
    render(SpokenText, {
      props: {
        text: 'keep\n\nthis  spacing',
        startMs: 10,
        staggerMs: 20
      }
    })

    expect(screen.getByText('keep')).toHaveClass('agent-talk-word')
    expect(screen.getByText('this')).toHaveClass('agent-talk-word')
    expect(screen.getByText('spacing')).toHaveClass('agent-talk-word')
    expect(
      screen.getByText('keep').style.getPropertyValue('--talk-delay')
    ).toBe('10ms')
    expect(
      screen.getByText('this').style.getPropertyValue('--talk-delay')
    ).toBe('30ms')
    expect(
      screen.getByText('spacing').style.getPropertyValue('--talk-delay')
    ).toBe('50ms')
  })
})
