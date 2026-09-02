// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import StaticFrame from './StaticFrame.vue'

describe('StaticFrame', () => {
  it('exposes the frame as an image only when it has a name', () => {
    render(StaticFrame, { props: { src: '/a.webp', alt: 'Seedance' } })
    expect(screen.getByRole('img', { name: 'Seedance' })).toBeTruthy()
  })

  it('stays decorative without a name', () => {
    render(StaticFrame, { props: { src: '/a.webp' } })
    expect(screen.getByTestId('static-frame').getAttribute('aria-hidden')).toBe(
      'true'
    )
  })
})
