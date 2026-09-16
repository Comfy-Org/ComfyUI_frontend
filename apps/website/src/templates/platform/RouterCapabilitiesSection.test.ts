import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RouterCapabilitiesSection from './RouterCapabilitiesSection.vue'

describe('RouterCapabilitiesSection', () => {
  it('presents each capability with an explanatory visual', () => {
    render(RouterCapabilitiesSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('img', { name: 'Integrate once. Add models as you go.' })
    ).toBeTruthy()
    expect(
      screen.getByRole('img', {
        name: 'Better availability. Better prices. Your choice of route.'
      })
    ).toBeTruthy()
  })

  it('identifies supported providers with logos', () => {
    render(RouterCapabilitiesSection, { props: { locale: 'en' } })

    for (const provider of ['fal', 'WaveSpeed', 'Runware', 'Pika', 'Replicate'])
      expect(screen.getAllByRole('img', { name: provider })).toHaveLength(1)
  })
})
