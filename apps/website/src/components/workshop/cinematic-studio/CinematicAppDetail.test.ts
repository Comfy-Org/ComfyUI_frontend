import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import CinematicAppDetail from './CinematicAppDetail.vue'

vi.mock(import('@/scripts/posthog'))

const model = (index: number): CinematicModel => ({
  slug: `model-${index}`,
  name: `Model ${index}`,
  provider: 'bfl',
  logo: ''
})
const models: CinematicModel[] = Array.from({ length: 10 }, (_, index) =>
  model(index + 1)
)

function renderDetail() {
  const user = userEvent.setup()
  return { user, ...render(CinematicAppDetail, { props: { models } }) }
}

describe('CinematicAppDetail', () => {
  it('opens the editor from every Try it', async () => {
    const { user, emitted } = renderDetail()

    for (const button of screen.getAllByRole('button', { name: 'Try it' }))
      await user.click(button)

    expect(emitted('try')).toEqual([[], []])
  })

  it('opens the editor on the starter shot that was picked', async () => {
    const { user, emitted } = renderDetail()

    await user.click(screen.getAllByTestId('cinematic-use-shot')[1])

    expect(emitted('try')).toEqual([['portrait']])
  })

  it('shows each starter with the direction it sets', () => {
    renderDetail()

    expect(
      screen.getByRole('heading', { name: 'Old fisherman on an overcast pier' })
    ).toBeVisible()
    expect(screen.getByText('85mm')).toBeVisible()
    expect(screen.getByText('Overcast')).toBeVisible()
  })

  it('lists a few models and reveals the rest on request', async () => {
    const { user } = renderDetail()
    expect(screen.queryByText('Model 10')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Show all 10' }))

    expect(screen.getByText('Model 10')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
