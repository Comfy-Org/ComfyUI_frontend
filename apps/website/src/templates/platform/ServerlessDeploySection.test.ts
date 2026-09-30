import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

vi.mock(import('../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => true
}))

describe('ServerlessDeploySection', () => {
  it('copies runnable commands without prompts or sample output', async () => {
    const user = userEvent.setup()
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    await user.click(screen.getByRole('button', { name: 'Copy commands' }))

    expect(await navigator.clipboard.readText()).toBe(
      'comfy build init\ncomfy build push --release --target linux/nvidia\ncomfy deploy up'
    )
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })
  it('presents the deploy transcript as a live terminal', () => {
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: t('platform.serverlessDeploy.shipHeading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.serverlessDeploy.shipSubtitle', 'en'))
    ).toBeTruthy()

    const terminal = screen.getByRole('img', {
      name: t('platform.serverlessDeploy.heading', 'en')
    })
    const transcript = terminal.textContent
    for (const line of [
      '$ comfy build init',
      '✔ Scanned this ComfyUI install — custom nodes, models, pinned deps',
      '$ comfy build push --release --target linux/nvidia',
      '✔ Build released',
      '$ comfy deploy up',
      '✔ Endpoint live → https://your-build.run.comfy.app'
    ]) {
      expect(transcript).toContain(line)
    }
  })
})
import userEvent from '@testing-library/user-event'
