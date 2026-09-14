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
    await user.type(screen.getByTestId('workshop-search'), 'minimax h3')
    expect(screen.getAllByTestId('hub-card-link')[0].textContent).toContain(
      'MiniMax H3'
    )
  })

  it('shows the Workshop model cards under the Models tab', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-tab-models'))
    expect(screen.queryByTestId('hub-grid')).toBeNull()
    expect(screen.getAllByTestId('workshop-model-card').length).toBeGreaterThan(
      10
    )
    await user.type(screen.getByTestId('workshop-search'), 'kling')
    const cards = screen.getAllByTestId('workshop-model-card')
    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((card) => expect(card.textContent).toMatch(/Kling/i))
  })

  it('narrows the hub from the shared search panel', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    expect(screen.queryByTestId('workshop-search-panel')).toBeNull()

    await user.click(screen.getByTestId('workshop-search'))
    await user.click(screen.getByTestId('workshop-search-provider-more'))
    const chip = screen.getByRole('button', { name: /^Kling\s+\d+$/ })
    await user.click(chip)

    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('hub-filter-count').textContent.trim()).toBe('1')
    const cards = screen.getAllByTestId('hub-card')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.length).toBeLessThan(30)
  })

  it('filters by a model facet from the Filter popover', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-filter'))
    await user.click(screen.getByTestId('hub-facet-models'))
    await user.click(await screen.findByRole('option', { name: 'Wan' }))
    expect(screen.getByTestId('hub-filter-count').textContent.trim()).toBe('1')
    expect(screen.getByTestId('hub-showing').textContent).toContain('of 36')
  })

  it('scopes both the models and the workflows to the chosen use case', async () => {
    const user = userEvent.setup()
    render(HubBrowse)

    await user.click(screen.getByTestId('hub-use-case-audio'))
    const lead = screen.getAllByTestId('hub-models-lead')
    expect(lead[0].textContent).toContain('ElevenLabs')
    expect(screen.getByTestId('hub-showing').textContent).toMatch(
      /of [1-9]\d*\b/
    )

    await user.click(screen.getByTestId('hub-tab-models'))
    expect(
      screen.queryAllByRole('link', { name: /Seed Audio/i }).length
    ).toBeGreaterThan(0)
    expect(
      screen.queryAllByRole('link', { name: /HeyGen/i }).length
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /FLUX 2 Max/i })).toBeNull()
    expect(screen.queryByTestId('model-card-versions')).toBeNull()
  })

  it('counts the applied filters in the popover and clears them', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-filter'))
    await user.click(screen.getByTestId('hub-facet-models'))
    await user.click(await screen.findByRole('option', { name: 'Wan' }))
    expect(screen.getByTestId('hub-facet-models').textContent).toContain(
      '1 selected'
    )

    await user.click(screen.getByTestId('hub-filter-clear'))
    expect(screen.queryByTestId('hub-filter-count')).toBeNull()
  })

  it('offers the orders each tab can honour, and orders by the one chosen', async () => {
    const user = userEvent.setup()
    render(HubBrowse)

    await user.click(screen.getByTestId('hub-tab-nodeGraphs'))
    await user.click(screen.getByTestId('hub-sort'))
    expect(screen.queryByTestId('hub-sort-priceAsc')).toBeNull()
    await user.click(await screen.findByTestId('hub-sort-name'))
    const titles = screen
      .getAllByTestId('hub-card-link')
      .map((card) => card.textContent.trim())
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)))

    await user.click(screen.getByTestId('hub-tab-models'))
    await user.click(screen.getByTestId('hub-sort'))
    expect(await screen.findByTestId('hub-sort-priceAsc')).toBeTruthy()
    expect(screen.queryByTestId('hub-sort-newest')).toBeNull()
  })

  it('filters from the phone panel, one facet at a time', async () => {
    const user = userEvent.setup()
    render(HubBrowse)
    await user.click(screen.getByTestId('hub-filter'))

    await user.click(screen.getByTestId('workshop-facet-media'))
    await user.click(await screen.findByTestId('filter-media-video'))

    expect(screen.getByTestId('hub-filter-count').textContent.trim()).toBe('1')
  })
})
