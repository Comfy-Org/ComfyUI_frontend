import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'

import { agentConsentTelemetryTest as test } from '@e2e/fixtures/agentConsentTelemetryFixture'

/**
 * A card that was shown and then went quiet used to cover three endings at
 * once - dismissed, an acceptance whose save did not stick, and (signed out) an
 * abandoned sign-in. `useAgentConsent.test.ts` pins all of them, but it arranges
 * a dismissal by calling the dialog's `onClose` prop directly. This file is here
 * because that is the one arrange a unit test cannot make faithfully: whether a
 * real Escape key or a real overlay click reaches that handler at all depends on
 * the dialog renderer, the dialog stack's escape bookkeeping and the overlay's
 * own hit area, none of which a hand-called callback exercises.
 */
test.describe(
  'Automatic consent card outcome',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ agentConsentAccepted: false })

    test('reports a dismissal when Escape closes the automatic card', async ({
      comfyPage,
      agentPanel,
      agentConsentWrites,
      consentTelemetry
    }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await test.step('The automatic offer reports exactly one impression', async () => {
        await expect(dialog).toBeVisible()
        await expect
          .poll(() =>
            consentTelemetry.filter(
              (e) => e.event === 'app:agent_consent_shown'
            )
          )
          .toEqual([
            {
              event: 'app:agent_consent_shown',
              properties: expect.objectContaining({ trigger: 'first_load' })
            }
          ])
      })

      await test.step('Escape reports the dismissal as its own outcome', async () => {
        expect(
          consentTelemetry.filter(
            (e) => e.event === 'app:agent_consent_resolved'
          )
        ).toEqual([])

        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)

        await expect
          .poll(() =>
            consentTelemetry.filter(
              (e) => e.event === 'app:agent_consent_resolved'
            )
          )
          .toEqual([
            {
              event: 'app:agent_consent_resolved',
              properties: expect.objectContaining({
                decision: 'dismissed',
                save_error_shown: false
              })
            }
          ])
        // Consent semantics are unchanged: a dismissal is still not a decision.
        expect(agentConsentWrites).toHaveLength(0)
        await expect(agentPanel.root).toHaveCount(0)
      })

      await test.step('One outcome per impression, not one per close path', async () => {
        // The dialog closes through `closeDialog`, which fires `onClose`, and
        // the promise settles separately. Both ran; only one event exists.
        expect(
          consentTelemetry.filter(
            (e) => e.event === 'app:agent_consent_resolved'
          )
        ).toHaveLength(1)
      })
    })

    test('reports the same outcome when the overlay mask closes the card', async ({
      comfyPage,
      agentConsentWrites,
      consentTelemetry
    }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await expect(dialog).toBeVisible()
      await page
        .getByTestId('dialog-overlay')
        .click({ position: { x: 1, y: 1 } })
      await expect(dialog).toHaveCount(0)

      await expect
        .poll(() =>
          consentTelemetry
            .filter((e) => e.event === 'app:agent_consent_resolved')
            .map((e) => e.properties.decision)
        )
        .toEqual(['dismissed'])
      expect(agentConsentWrites).toHaveLength(0)
    })

    test('reports an acceptance, not a dismissal, when the card is accepted', async ({
      comfyPage,
      agentPanel,
      agentConsentWrites,
      consentTelemetry
    }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await expect(dialog).toBeVisible()
      await dialog
        .getByRole('button', { name: enMessages.agent.consent.accept })
        .click()
      await expect(dialog).toHaveCount(0)
      await expect(agentPanel.root).toBeVisible()

      // `closeWith` settles before closing the dialog, so the accepted outcome
      // must not be followed by a dismissal from the close it performs itself.
      await expect
        .poll(() =>
          consentTelemetry
            .filter((e) => e.event === 'app:agent_consent_resolved')
            .map((e) => e.properties.decision)
        )
        .toEqual(['accepted'])
      expect(agentConsentWrites).toEqual([true])
    })

    test('names a failed consent read at the request, not just at the load', async ({
      comfyPage,
      agentPanel,
      consentTelemetry
    }) => {
      const page = comfyPage.page
      // Every read fails. The automatic chain exits at the `load` stage without
      // asking, which `gc-16`'s instrument already names; the user then clicks
      // the entry button, and that attempt fails inside the request. This is the
      // shape behind the 23 `agent_consent_setting_load_failure` events in
      // Sentry that product analytics saw nothing of.
      await page.route(
        `**/api/global-settings/${AGENT_CONSENT_SETTING_ID}`,
        (route) => route.fulfill({ status: 500, body: '{"code":"INTERNAL"}' })
      )
      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(agentPanel.openButton).toBeEnabled()
      await agentPanel.openButton.click()

      await expect
        .poll(() =>
          consentTelemetry
            .filter((e) => e.event === 'app:agent_consent_offer_exited')
            .map((e) => [e.properties.stage, e.properties.exit])
        )
        .toContainEqual(['request', 'consent_read_failed'])

      // The same condition at two links, told apart by the pair rather than by
      // the reason value - which is what `exit` plus `stage` is for.
      const requestExits = consentTelemetry.filter(
        (e) =>
          e.event === 'app:agent_consent_offer_exited' &&
          e.properties.stage === 'request'
      )
      expect(requestExits.map((e) => e.properties)).toEqual([
        {
          exit: 'consent_read_failed',
          stage: 'request',
          retry_armed: false,
          trigger: 'button_click'
        }
      ])
      await expect(
        page.getByRole('dialog', { name: enMessages.agent.consent.title })
      ).toHaveCount(0)
      await expect(agentPanel.root).toHaveCount(0)
    })
  }
)
