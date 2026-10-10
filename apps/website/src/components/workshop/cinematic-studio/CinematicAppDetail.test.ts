import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { appModels } from '@/config/workshop-app-content'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import CinematicAppDetail from './CinematicAppDetail.vue'

vi.mock(import('@/scripts/posthog'))

const studio = appModels.find((app) => app.appId === 'studio')!
const models: CinematicModel[] = [
  { slug: 'flux', name: 'FLUX.2', provider: 'bfl', logo: '' }
]

function renderDetail() {
  const user = userEvent.setup()
  const view = render(CinematicAppDetail, {
    props: { app: studio, apps: appModels, models }
  })
  return { user, ...view }
}

describe('CinematicAppDetail', () => {
  it('heads the page like a model page, with the app and its category', () => {
    renderDetail()

    expect(
      screen.getByRole('heading', { level: 1, name: studio.name })
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Generate images' })).toBeVisible()
  })

  it('opens the editor from Try it', async () => {
    const { user, emitted } = renderDetail()

    await user.click(screen.getByRole('button', { name: 'Try it' }))

    expect(emitted('try')).toEqual([[]])
  })

  it('opens the editor on the example that was picked', async () => {
    const { user, emitted } = renderDetail()

    await user.click(
      screen.getByRole('button', { name: 'Old fisherman on an overcast pier' })
    )

    expect(emitted('try')).toEqual([['portrait']])
  })

  it('offers the other apps, but not this one', () => {
    renderDetail()

    const others = appModels.filter((app) => app.slug !== studio.slug)
    for (const other of others)
      expect(screen.getByRole('link', { name: new RegExp(other.name) })).toBeVisible()
    expect(screen.queryAllByTestId('workshop-app-card')).toHaveLength(
      others.length
    )
  })
})
