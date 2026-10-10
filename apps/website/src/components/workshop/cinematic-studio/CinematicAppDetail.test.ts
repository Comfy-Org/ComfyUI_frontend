import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import CinematicAppDetail from './CinematicAppDetail.vue'

vi.mock(import('@/scripts/posthog'))

const models: CinematicModel[] = [
  { slug: 'flux', name: 'FLUX.2', provider: 'bfl', logo: '' },
  { slug: 'seedream', name: 'Seedream 4', provider: 'bytedance', logo: '' }
]

describe('CinematicAppDetail', () => {
  it('names the models the app runs on', () => {
    render(CinematicAppDetail, { props: { models } })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cinematic Studio' })
    ).toBeVisible()
    expect(screen.getByText('FLUX.2')).toBeVisible()
    expect(screen.getByText('Seedream 4')).toBeVisible()
  })

  it('asks to open the editor when Try it is pressed', async () => {
    const { emitted } = render(CinematicAppDetail, { props: { models } })

    await userEvent.click(screen.getByRole('button', { name: 'Try it' }))

    expect(emitted('try')).toHaveLength(1)
  })
})
