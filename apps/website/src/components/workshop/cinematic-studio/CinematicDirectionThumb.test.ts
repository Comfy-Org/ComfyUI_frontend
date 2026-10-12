import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CinematicDirectionThumb from './CinematicDirectionThumb.vue'

const frame = '/images/cinematic-studio/options/shot-wide.jpg'
const palette = ['rgb(31, 78, 90)', 'rgb(224, 160, 96)']

function renderThumb(option: { preview?: string; palette?: string[] }) {
  render(CinematicDirectionThumb, { props: { option } })
}

describe('CinematicDirectionThumb', () => {
  it('shows the preview frame of an option that has one', () => {
    renderThumb({ preview: frame })

    expect(screen.getByTestId('direction-thumb-frame')).toHaveAttribute(
      'src',
      frame
    )
  })

  it('shows a grade as its palette stripes, not a frame', () => {
    renderThumb({ palette, preview: frame })

    expect(screen.queryByTestId('direction-thumb-frame')).toBeNull()
    expect(
      screen
        .getAllByTestId('direction-thumb-stripe')
        .map((stripe) => stripe.style.backgroundColor)
    ).toEqual(palette)
  })

  it('shows a dashed circle for an option with neither, like Auto', () => {
    renderThumb({})

    expect(screen.queryByTestId('direction-thumb-frame')).toBeNull()
    expect(screen.getByTestId('direction-thumb-auto')).toBeInTheDocument()
  })
})
