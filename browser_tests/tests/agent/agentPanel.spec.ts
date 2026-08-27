import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('In-App Agent panel shell', { tag: '@cloud' }, () => {
  test.describe('flag off', () => {
    test.use({ agentFlagEnabled: false })

    test('exposes no agent surface at all', async ({ comfyPage }) => {
      const page = comfyPage.page

      // Positive anchor: the button's own container rendered, so absence
      // below means gated off, not a missing tab bar.
      await expect(page.getByTestId('integrated-tab-bar-actions')).toBeVisible()
      // The gate settles asynchronously; assert only after it has run, so a
      // late enable cannot slip past auto-retrying negative assertions.
      // Worst case: the gate settles by retry exhaustion (~5s) when the
      // flag is off, since posthog drops false-valued bootstrap flags.
      await expect(page.locator('body')).toHaveAttribute(
        'data-agent-gate-settled',
        'true',
        { timeout: 15_000 }
      )

      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL })
      ).toHaveCount(0)
      await expect(page.getByTestId('docked-agent-panel')).toHaveCount(0)
    })
  })

  test('the entry button docks the shell and its close button undocks it', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()

    const panel = page.getByTestId('docked-agent-panel')
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('agent-panel-root')).toBeVisible()

    await panel.getByRole('button', { name: enMessages.agent.close }).click()
    await expect(panel).toHaveCount(0)
  })
})
