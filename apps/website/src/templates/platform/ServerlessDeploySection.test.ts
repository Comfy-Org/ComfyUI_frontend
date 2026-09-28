import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

vi.mock(import('../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => true
}))

describe('ServerlessDeploySection', () => {
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

  it('copies the agent setup prompt and confirms the action', async () => {
    const user = userEvent.setup()
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    await user.click(screen.getByRole('button', { name: 'COPY AGENT PROMPT' }))

    expect(await navigator.clipboard.readText()).toContain(
      'pip install -U comfy-cli'
    )
    expect(
      screen.getByRole('button', { name: 'AGENT PROMPT COPIED' })
    ).toBeTruthy()
  })
})
