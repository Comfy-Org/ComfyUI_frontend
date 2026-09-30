import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessDeploySection from './ServerlessDeploySection.vue'

vi.mock(import('../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => true
}))

describe('ServerlessDeploySection', () => {
  it('copies the agent prompt verbatim', async () => {
    const user = userEvent.setup()
    render(ServerlessDeploySection, { props: { locale: 'en' } })

    await user.click(screen.getByRole('button', { name: 'Copy commands' }))

    expect(await navigator.clipboard.readText())
      .toBe(`Install comfy-cli and read its build skill:

\`pip install -U comfy-cli\`, then \`comfy skills show comfy-build\`.

It covers packaging a local ComfyUI install — models, custom nodes, dependency pins — into a build on platform.comfy.org and cutting a release. \`comfy skills show comfy-deploy\` covers running that release as a serverless endpoint.`)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })
  it('presents the agent prompt as a live terminal', () => {
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
      'Install comfy-cli and read its build skill:',
      '`pip install -U comfy-cli`, then `comfy skills show comfy-build`.',
      '`comfy skills show comfy-deploy` covers running that release as a serverless endpoint.'
    ]) {
      expect(transcript).toContain(line)
    }
  })
})
import userEvent from '@testing-library/user-event'
