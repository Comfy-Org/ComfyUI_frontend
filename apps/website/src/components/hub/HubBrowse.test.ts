// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { useHubStore } from '../../composables/useHubStore'
import HubBrowse from './HubBrowse.vue'

afterEach(() => {
  useHubStore().reset()
})

describe('HubBrowse', () => {
  it('scopes the grid to Comfy Apps and narrows it by search', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    expect(screen.getAllByTestId('hub-card')).toHaveLength(30)

    await user.click(screen.getByTestId('hub-tab-comfyApps'))
    const apps = screen.getAllByTestId('hub-card')
    expect(apps.length).toBeGreaterThan(0)
    expect(apps.every((card) => card.getAttribute('data-app') === 'true')).toBe(
      true
    )

    await user.click(screen.getByTestId('hub-tab-all'))
    await user.type(screen.getByTestId('hub-search'), 'minimax h3')
    expect(screen.getAllByTestId('hub-card-link')[0].textContent).toContain(
      'MiniMax H3'
    )
  })

  it('filters by a model facet from the Filter popover', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-filter'))
    await user.click(await screen.findByRole('option', { name: /^Wan \d+$/ }))
    expect(screen.getByTestId('hub-filter-count').textContent?.trim()).toBe('1')
    expect(screen.getByTestId('hub-showing').textContent).toContain('of 36')
  })
})
