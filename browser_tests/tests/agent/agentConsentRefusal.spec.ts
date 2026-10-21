import { expect } from '@playwright/test'

import { AGENT_CONSENT_OFFER_DECLINED_SETTING_ID } from '@/platform/settings/constants/agent'

import { agentConsentTelemetryTest as test } from '@e2e/fixtures/agentConsentTelemetryFixture'
import { AGENT_COACH_SEEN_KEY } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent consent refusal outlives the device',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.describe.configure({ timeout: 60_000 })
    test.use({
      agentConsentAccepted: false,
      agentPanelInitiallyOpen: true,
      initialLocalStorage: { [AGENT_COACH_SEEN_KEY]: 'true' }
    })

    test('suppresses automatic promotion on another device but lets Send offer again', async ({
      comfyPage,
      agentPanel,
      consentTelemetry,
      postedMessages
    }) => {
      await test.step('Refusing the automatic card is stored for the account', async () => {
        await expect(agentPanel.consentDialog).toBeVisible()
        await agentPanel.consentRejectButton.click()
        await expect(agentPanel.consentDialog).toHaveCount(0)

        await expect
          .poll(() =>
            comfyPage.settings.getPersistedSetting(
              AGENT_CONSENT_OFFER_DECLINED_SETTING_ID
            )
          )
          .toBe(true)
      })

      await test.step('A fresh device makes no automatic offer', async () => {
        await comfyPage.page.evaluate(
          ({ userId, coachSeenKey }) => {
            localStorage.clear()
            sessionStorage.clear()
            localStorage.setItem('Comfy.userId', userId)
            localStorage.setItem(coachSeenKey, 'true')
          },
          { userId: comfyPage.id, coachSeenKey: AGENT_COACH_SEEN_KEY }
        )
        await comfyPage.cloudAuth.mockAuth()
        await comfyPage.goto()
        await comfyPage.waitForAppReady()

        await expect
          .poll(() =>
            consentTelemetry.some(
              ({ event, properties }) =>
                event === 'app:agent_consent_offer_exited' &&
                properties.exit === 'consent_declined'
            )
          )
          .toBe(true)
        await expect(agentPanel.consentDialog).toHaveCount(0)
        await expect(agentPanel.root).toBeVisible()
      })

      await test.step('Send offers the card again and posts nothing until accepted', async () => {
        await agentPanel.selectWorkflow()
        await agentPanel.sendMessage('Add an upscaler to this workflow')
        await expect(agentPanel.consentDialog).toBeVisible()
        expect(postedMessages).toHaveLength(0)

        await agentPanel.consentRejectButton.click()
        await expect(agentPanel.consentDialog).toHaveCount(0)
        expect(postedMessages).toHaveLength(0)
      })
    })
  }
)
