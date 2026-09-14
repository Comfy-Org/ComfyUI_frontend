import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SectionHeader from './SectionHeader.vue'

describe('SectionHeader', () => {
  it('renders a subsection with the configured heading semantics', () => {
    render(SectionHeader, {
      props: { headingSize: 'subsection', headingTag: 'h3' },
      slots: { default: 'Developer Platform pricing' }
    })

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Developer Platform pricing'
      })
    ).toBeTruthy()
  })
})
