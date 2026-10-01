import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { deployPromptFor } from '../../config/deploy-prompt'
import { t } from '../../i18n/translations'
import ServerlessAgentPromptBanner from './ServerlessAgentPromptBanner.vue'

describe('ServerlessAgentPromptBanner', () => {
  it('shows the skip-the-setup line and copies the agent prompt verbatim', async () => {
    const user = userEvent.setup()
    render(ServerlessAgentPromptBanner, { props: { locale: 'en' } })

    expect(
      screen.getByText(t('platform.serverlessDeploy.agentPromptLine', 'en'))
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'COPY AGENT PROMPT' }))

    expect(await navigator.clipboard.readText()).toBe(deployPromptFor('en'))
    expect(screen.getByRole('button', { name: 'COPIED' })).toBeTruthy()
  })

  it('localizes the line, button, and prompt for zh-CN', async () => {
    const user = userEvent.setup()
    render(ServerlessAgentPromptBanner, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByText(t('platform.serverlessDeploy.agentPromptLine', 'zh-CN'))
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '复制智能体提示词' }))

    expect(await navigator.clipboard.readText()).toBe(deployPromptFor('zh-CN'))
  })
})
