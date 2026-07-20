import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ActiveTabStrip from './ActiveTabStrip.vue'

describe('ActiveTabStrip', () => {
  it('shows the tab name, and nothing when there is no tab', async () => {
    const { rerender } = render(ActiveTabStrip, {
      props: { tab: { path: 'workflows/portrait.json', name: 'portrait.json' } }
    })
    expect(screen.getByText('portrait.json')).not.toBeNull()

    await rerender({ tab: null })
    expect(screen.queryByText('portrait.json')).toBeNull()
  })
})
