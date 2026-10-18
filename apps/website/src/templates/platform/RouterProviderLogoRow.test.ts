import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RouterProviderLogoRow from './RouterProviderLogoRow.vue'

const providers = [
  { name: 'fal', src: '/fal.svg' },
  { name: 'WaveSpeed', src: '/wavespeed.svg' }
]

describe('RouterProviderLogoRow', () => {
  it('lists each provider once when static', () => {
    render(RouterProviderLogoRow, { props: { providers, animated: false } })

    for (const { name } of providers)
      expect(screen.getAllByRole('img', { name })).toHaveLength(1)
  })

  it('hides the marquee duplicate of every logo from assistive technology', () => {
    render(RouterProviderLogoRow, { props: { providers, animated: true } })

    for (const { name } of providers) {
      const exposed = screen.getAllByRole('img', { name })
      const rendered = screen.getAllByAltText(name)
      expect(rendered).toHaveLength(exposed.length * 2)
    }
  })
})
