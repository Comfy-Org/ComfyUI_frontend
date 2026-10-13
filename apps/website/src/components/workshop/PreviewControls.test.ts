import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import { useWorkshopFlag } from '@/scripts/posthog'
import ExploreCatalogue from './ExploreCatalogue.vue'
import PreviewControls from './PreviewControls.vue'

vi.mock(import('@/scripts/posthog'))

beforeEach(() => {
  setPreviewSwitch('hub-home-community', false)
  window.localStorage.clear()
  vi.mocked(useWorkshopFlag).mockReturnValue(readonly(ref(false)))
})

async function communitySwitch(user: ReturnType<typeof userEvent.setup>) {
  if (!screen.queryByRole('menu'))
    await user.click(screen.getByRole('button', { name: 'Preview controls' }))
  return screen.findByRole('menuitemcheckbox', { name: 'From the community' })
}

describe('PreviewControls', () => {
  it('renders nothing on a production build', () => {
    render(PreviewControls, { props: { enabled: false } })

    expect(screen.queryByTestId('preview-controls')).toBeNull()
  })

  it('switches the community block on for this browser and keeps the choice', async () => {
    const user = userEvent.setup()
    const { unmount } = render(PreviewControls, { props: { enabled: true } })

    expect(await communitySwitch(user)).toHaveAttribute('aria-checked', 'false')
    await user.click(await communitySwitch(user))
    expect(await communitySwitch(user)).toHaveAttribute('aria-checked', 'true')
    expect(
      window.localStorage.getItem('comfy-preview-switch:hub-home-community')
    ).toBe('on')

    unmount()
    render(PreviewControls, { props: { enabled: true } })
    expect(await communitySwitch(user)).toHaveAttribute('aria-checked', 'true')
  })

  it('shows and hides the Hub home community block', async () => {
    const user = userEvent.setup()
    render(ExploreCatalogue, { props: { apps: [], workflows: [], models: [] } })
    render(PreviewControls, { props: { enabled: true } })
    const community = () => screen.queryByTestId('explore-community')
    expect(community()).toBeNull()

    await user.click(await communitySwitch(user))
    expect(await screen.findByTestId('explore-community')).toBeVisible()

    await user.click(await communitySwitch(user))
    await waitFor(() => expect(community()).toBeNull())
  })

  it('reads a stored choice over the flag when the page loads', async () => {
    vi.resetModules()
    window.localStorage.setItem(
      'comfy-preview-switch:hub-home-community',
      'off'
    )
    const posthog = await import('@/scripts/posthog')
    vi.mocked(posthog.useWorkshopFlag).mockReturnValue(readonly(ref(true)))
    const { usePreviewSwitch } = await import('@/lib/workshop/preview-switches')

    expect(usePreviewSwitch('hub-home-community').value).toBe(false)
  })
})
