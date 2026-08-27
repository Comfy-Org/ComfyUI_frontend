import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('In-App Agent panel shell', { tag: '@cloud' }, () => {
  test.describe('flag off', () => {
    test.use({ agentFlagEnabled: false })

    test('exposes no agent surface at all', async ({
      page,
      agentFlagEnabled
    }) => {
      await bootAgentApp(page, agentFlagEnabled)

      // Positive anchor: the button's own container rendered, so absence
      // below means gated off, not a missing tab bar.
      await expect(page.getByTestId('integrated-tab-bar-actions')).toBeVisible()
      // The gate settles asynchronously; assert only after it has run, so a
      // late enable cannot slip past auto-retrying negative assertions.
      // Flag-off settles on the flags delivery (posthog fires its callback
      // even when every bootstrap flag is false); the timeout only covers
      // the no-token path.
      await expect(
        page.getByTestId('integrated-tab-bar-actions')
      ).toHaveAttribute('data-agent-gate-settled', 'true', {
        timeout: 8_000
      })

      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL })
      ).toHaveCount(0)
      await expect(page.getByTestId('docked-agent-panel')).toHaveCount(0)
    })
  })

  test('the entry button docks the shell and its close button undocks it', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled)

    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()

    const panel = page.getByTestId('docked-agent-panel')
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('agent-panel-root')).toBeVisible()

    await panel.getByRole('button', { name: enMessages.g.close }).click()
    await expect(panel).toHaveCount(0)
  })
})
