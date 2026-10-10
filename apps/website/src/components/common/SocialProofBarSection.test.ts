import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SocialProofBarSection from './SocialProofBarSection.vue'

describe('SocialProofBarSection', () => {
  it('renders four desktop marquee copies and exposes only the first to assistive tech', () => {
    render(SocialProofBarSection)

    const desktop = within(screen.getByTestId('social-proof-desktop'))

    expect(
      desktop.getAllByRole('img', { name: 'Apple', hidden: true })
    ).toHaveLength(4)
    expect(desktop.getAllByRole('img', { name: 'Apple' })).toHaveLength(1)
  })
})
