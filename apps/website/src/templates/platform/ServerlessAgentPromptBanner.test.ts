import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { COMFY_API_AGENT_PROMPT } from '../../config/comfy-api-agent-prompt'
import { t } from '../../i18n/translations'
import ServerlessAgentPromptBanner from './ServerlessAgentPromptBanner.vue'

describe('ServerlessAgentPromptBanner', () => {
  it('copies the full agent prompt, not just the preview commands', async () => {
    const user = userEvent.setup()
    render(ServerlessAgentPromptBanner, { props: { locale: 'en' } })

    expect(
      screen.getByText(t('platform.serverlessDeploy.agentPromptLine', 'en'))
    ).toBeTruthy()

    await user.click(
      screen.getByRole('button', {
        name: t('platform.serverlessDeploy.agentPromptButton', 'en')
      })
    )

    expect(await navigator.clipboard.readText()).toBe(COMFY_API_AGENT_PROMPT)
    expect(
      screen.getByRole('button', {
        name: t('platform.serverlessDeploy.agentPromptCopied', 'en')
      })
    ).toBeTruthy()
  })
})
