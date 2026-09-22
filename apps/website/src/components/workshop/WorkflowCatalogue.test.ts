import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowCatalogue from './WorkflowCatalogue.vue'
import { workflowCategories } from '../../config/workflow-catalogue'

describe('workflow category filtering', () => {
  it('shows six workflows per shelf and switches the featured destination', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue)
    for (const name of workflowCategories) {
      expect(
        within(screen.getByRole('region', { name })).getAllByTestId(
          'workshop-workflow-card'
        )
      ).toHaveLength(6)
    }
    const firstVideoCard = within(
      screen.getByRole('region', { name: 'Create & edit videos' })
    ).getAllByTestId('workshop-workflow-card')[0]
    expect(within(firstVideoCard).getByRole('heading')).toHaveTextContent(
      'Remove an object from a video'
    )
    const hero = screen.getByRole('region', { name: 'Featured workflows' })
    expect(workflowCategories[0]).toBe('Create & edit videos')
    expect(screen.getAllByTestId('workshop-workflow-card')).toHaveLength(30)
    expect(
      within(hero).getByRole('link', { name: 'Try this workflow' })
    ).toHaveAttribute('href', '/models/workflows/image-to-video/')
    expect(within(hero).getAllByRole('button')).toHaveLength(5)
    await user.click(
      within(hero).getByRole('button', { name: /Create product photos/ })
    )
    expect(
      within(hero).getByRole('link', { name: 'Try this workflow' })
    ).toHaveAttribute('href', '/models/workflows/change-material/')
    await user.type(
      screen.getByRole('searchbox', { name: 'Search workflows' }),
      'custom nodes'
    )
    expect(screen.getAllByTestId('workshop-workflow-card')).toHaveLength(1)
    expect(
      screen.getByRole('heading', { name: 'Remove an object from a video' })
    ).toBeVisible()
  })

  it('combines categories and clears them through the shared filter panel', async () => {
    const user = userEvent.setup()
    render(WorkflowCatalogue)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const panel = await screen.findByRole('dialog', { name: 'Filter' })
    await user.click(
      within(panel).getByRole('button', { name: /^Animate characters \d/ })
    )
    expect(
      screen.queryByRole('region', { name: 'Create product photos & ads' })
    ).toBeNull()
    await user.click(
      within(panel).getByRole('button', { name: /^Upscale & restore \d/ })
    )
    expect(
      screen.getByRole('region', { name: 'Animate characters' })
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Upscale & restore' })
    ).toBeVisible()
    await user.click(within(panel).getByTestId('workshop-filter-sheet-clear'))
    expect(
      screen.getByRole('region', { name: 'Create product photos & ads' })
    ).toBeVisible()
    within(panel).getByRole('searchbox').focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
