import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import { useWorkshopFlag } from '@/scripts/posthog'
import PreviewControls from './PreviewControls.vue'

vi.mock(import('@/scripts/posthog'))

beforeEach(() => {
  setPreviewSwitch('hub-models-compare', false)
  window.localStorage.clear()
  vi.mocked(useWorkshopFlag).mockReturnValue(readonly(ref(false)))
})

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  if (!screen.queryByRole('menu'))
    await user.click(screen.getByRole('button', { name: 'Design tweaks' }))
  return screen.findByRole('menu')
}

describe('PreviewControls', () => {
  it('renders nothing on a production build', () => {
    render(PreviewControls, { props: { enabled: false } })

    expect(screen.queryByTestId('preview-controls')).toBeNull()
  })

  it('lists each tweak under the page it changes, with what it does', async () => {
    const user = userEvent.setup()
    render(PreviewControls, { props: { enabled: true } })
    await openPanel(user)

    const models = screen.getByTestId('preview-group-models')
    expect(within(models).getByText('Hub · Models')).toBeVisible()
    expect(
      within(models).getByRole('menuitemcheckbox', { name: /Compare models/ })
    ).toHaveTextContent('see them side by side')
    expect(
      within(screen.getByTestId('preview-group-home')).getByRole(
        'menuitemcheckbox',
        { name: /Pick · Remix · Run banner/ }
      )
    ).toBeVisible()
  })

  it('switches a tweak on for this browser and keeps the choice', async () => {
    const user = userEvent.setup()
    const compare = async () =>
      within(await openPanel(user)).getByRole('menuitemcheckbox', {
        name: /Compare models/
      })
    const { unmount } = render(PreviewControls, { props: { enabled: true } })

    expect(await compare()).toHaveAttribute('aria-checked', 'false')
    await user.click(await compare())
    expect(await compare()).toHaveAttribute('aria-checked', 'true')
    expect(
      window.localStorage.getItem('comfy-preview-switch:hub-models-compare')
    ).toBe('on')

    unmount()
    render(PreviewControls, { props: { enabled: true } })
    expect(await compare()).toHaveAttribute('aria-checked', 'true')
  })
})
