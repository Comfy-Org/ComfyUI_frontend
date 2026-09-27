// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import PlayPauseButton from './PlayPauseButton.vue'

function renderButton(props: Record<string, unknown> = {}) {
  render(PlayPauseButton, { props, attrs: { 'aria-label': 'Play' } })
  return screen.getByRole('button', { name: 'Play' })
}

describe('PlayPauseButton', () => {
  it('renders the solid yellow control button by default', () => {
    const button = renderButton()

    expect(button.classList.contains('bg-primary-comfy-yellow')).toBe(true)
  })

  it('renders the frosted overlay squircle for the overlay variant', () => {
    const button = renderButton({ variant: 'overlay' })

    expect(button.classList.contains('backdrop-blur-[9px]')).toBe(true)
    expect(button.classList.contains('bg-primary-comfy-yellow')).toBe(false)
    // Play state shows the triangle glyph
    expect(button.innerHTML).toContain('<path')
    expect(button.innerHTML).not.toContain('<rect')
  })

  it('swaps the overlay glyph to pause bars while playing', () => {
    const button = renderButton({ variant: 'overlay', playing: true })

    expect(button.innerHTML).toContain('<rect')
    expect(button.innerHTML).not.toContain('<path')
  })
})
