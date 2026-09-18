import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowCatalogue from './WorkflowCatalogue.vue'

describe('workflow category filtering', () => {
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
