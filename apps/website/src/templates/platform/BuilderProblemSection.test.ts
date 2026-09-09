// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import BuilderProblemSection from './BuilderProblemSection.vue'

describe('BuilderProblemSection', () => {
  it('lists the four problems without the placeholder quote', () => {
    render(BuilderProblemSection, { props: { locale: 'en' } })

    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByText(/Debugging our GPU cloud/)).toBeNull()
  })
})
