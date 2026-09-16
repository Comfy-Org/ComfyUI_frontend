import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import RouterRoadmapSection from './RouterRoadmapSection.vue'

describe('RouterRoadmapSection', () => {
  it('links to the Router documentation with one section-level call to action', () => {
    render(RouterRoadmapSection, { props: { locale: 'en' } })

    expect(screen.getAllByRole('link', { name: 'LEARN MORE' })).toHaveLength(1)
  })
})
