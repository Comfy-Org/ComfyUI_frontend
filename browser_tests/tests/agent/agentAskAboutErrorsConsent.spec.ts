import { expect } from '@playwright/test'

import { agentConsentTest as test } from '@e2e/fixtures/agentConsentFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { TestIds } from '@e2e/fixtures/selectors'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.describe('Ask agent about errors', { tag: ['@cloud', '@ui'] }, () => {
  test.use({
    agentConsentAccepted: false,
    initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true },
    initialLocalStorage: {
      'Comfy.AgentConsent.IntroductionResponded.test-user-e2e.ws-personal':
        'true'
    }
  })

  test('asks for consent before the panel opens and attaches the error only after Agree', async ({
    comfyPage,
    agentConsentWrites
  }) => {
    const page = comfyPage.page
    const agentPanel = new AgentPanel(page)
    const panel = agentPanel.root
    const dialog = agentPanel.consentDialog
    const overlay = page.getByTestId(TestIds.dialogs.errorOverlay)
    const askAgent = overlay.getByTestId('error-overlay-ask-agent')
    const chip = page.getByTestId('error-reference-chip')

    await expect(panel).toBeVisible()
    await agentPanel.close()
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')
    await expect(overlay).toBeVisible()
    await page.mouse.move(400, 400)
    await expectElementScreenshot(overlay, 'ask-agent-error-toast.png')

    await test.step('Skip leaves the panel closed with nothing attached', async () => {
      await askAgent.click()
      await expect(dialog).toBeVisible()
      await expect(panel).toHaveCount(0)

      await agentPanel.consentRejectButton.click()
      await expect(dialog).toHaveCount(0)
      await expect(panel).toHaveCount(0)
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('Agree opens the panel with the error in the composer', async () => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')
      await expect(overlay).toBeVisible()
      await askAgent.click()
      await agentPanel.consentAcceptButton.click()

      await expect(dialog).toHaveCount(0)
      await expect(panel).toBeVisible()
      await expect(chip).toBeVisible()
      await expect(agentPanel.composer).toBeFocused()
      await expectElementScreenshot(chip, 'ask-agent-error-reference-chip.png')
    })
  })
})
