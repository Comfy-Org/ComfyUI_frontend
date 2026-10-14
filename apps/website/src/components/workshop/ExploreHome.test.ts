import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { workshopModels } from '@/config/workshop-browse-content'
import ExploreHome from './ExploreHome.vue'

const renderHome = () =>
  render(ExploreHome, { props: { models: workshopModels, appsShown: true } })

const resultNames = () =>
  within(screen.getByTestId('explore-results'))
    .getAllByRole('link')
    .map((link) => link.textContent.trim())

describe('Hub home', () => {
  it('opens on the doors and the popular row', () => {
    renderHome()

    expect(screen.getByTestId('explore-doors')).toBeTruthy()
    expect(resultNames().length).toBeGreaterThan(0)
  })

  it('answers a search with what matches it, and puts the doors away', async () => {
    renderHome()

    await userEvent
      .setup()
      .type(screen.getByTestId('explore-search'), 'upscale')

    await waitFor(() =>
      expect(screen.queryByTestId('explore-doors')).toBeNull()
    )
    const names = resultNames().join(' ').toLowerCase()
    expect(names).toContain('upscale')
  })

  it('brings the doors back when the search is cleared', async () => {
    renderHome()
    const user = userEvent.setup()
    const box = screen.getByTestId('explore-search')

    await user.type(box, 'upscale')
    await waitFor(() =>
      expect(screen.queryByTestId('explore-doors')).toBeNull()
    )
    await user.clear(box)

    expect(await screen.findByTestId('explore-doors')).toBeTruthy()
  })
})
