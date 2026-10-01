import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { deployPromptFor } from '../../config/deploy-prompt'
import { t } from '../../i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

vi.mock(import('../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => true
}))

describe('ServerlessDeploySection', () => {
  it('presents a short illustrative transcript, not the full agent prompt', () => {
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
      'comfy build init',
      'comfy build push --release --target linux/nvidia',
      'comfy deploy up'
    ]) {
      expect(transcript).toContain(line)
    }
    expect(transcript).not.toContain(deployPromptFor('en'))
  })

  it('copies the full agent prompt from the button below the terminal', async () => {
    const user = userEvent.setup()
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))

    expect(await navigator.clipboard.readText()).toBe(deployPromptFor('en'))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })

  it('localizes the subtitle, button, and prompt for zh-CN', async () => {
    const user = userEvent.setup()
    render(ServerlessDeploySection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByText(t('platform.serverlessDeploy.shipSubtitle', 'zh-CN'))
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '复制提示词' }))

    expect(await navigator.clipboard.readText()).toBe(deployPromptFor('zh-CN'))
  })
})
