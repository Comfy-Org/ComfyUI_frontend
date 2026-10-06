import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelAccessBadges from './ModelAccessBadges.vue'

describe('ModelAccessBadges', () => {
  it('lists the ways in a fixed order as plain, alike text tags', () => {
    render(ModelAccessBadges, { props: { access: ['download', 'api', 'run'] } })
    const tags = screen.getAllByTestId('model-access-badge')

    expect(tags.map((tag) => tag.textContent.trim())).toEqual([
      'Run',
      'API',
      'Download'
    ])
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(new Set(tags.map((tag) => tag.className)).size).toBe(1)
  })
})
