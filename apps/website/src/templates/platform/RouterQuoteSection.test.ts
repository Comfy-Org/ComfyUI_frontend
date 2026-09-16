import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RouterQuoteSection from './RouterQuoteSection.vue'

describe('RouterQuoteSection', () => {
  it('shows only the Silverside quote with no carousel controls', () => {
    render(RouterQuoteSection, { props: { locale: 'en' } })

    expect(screen.getByText('Co-founder of Silverside AI')).toBeTruthy()
    expect(screen.queryByText(/Black Math/)).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
