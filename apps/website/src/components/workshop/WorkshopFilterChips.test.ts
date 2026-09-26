import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkshopFilterChips from './WorkshopFilterChips.vue'

const chips = [
  { key: 'use:video', label: 'Generate videos' },
  { key: 'model:SeedVR2', label: 'Runs on SeedVR2' }
]

describe('workshop filter chips', () => {
  it('draws nothing when nothing was narrowed', () => {
    render(WorkshopFilterChips, { props: { chips: [] } })
    expect(screen.queryByTestId('workshop-filter-chips')).toBeNull()
  })

  it.for(chips)(
    'gives back the choice whose cross was pressed (%o)',
    async (chip) => {
      const user = userEvent.setup()
      const { emitted } = render(WorkshopFilterChips, { props: { chips } })

      await user.click(
        screen.getByRole('button', { name: `Remove ${chip.label}` })
      )
      expect(emitted('remove')).toEqual([[chip.key]])
    }
  )

  it('lets go of every choice at once', async () => {
    const user = userEvent.setup()
    const { emitted } = render(WorkshopFilterChips, { props: { chips } })

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(emitted('clear')).toHaveLength(1)
  })
})
