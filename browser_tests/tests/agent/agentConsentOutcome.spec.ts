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
    test.use({
      agentConsentAccepted: false,
      agentPanelInitiallyOpen: true
    })

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
        // Activation now opens the panel independently of consent. Dismissing
        // the automatic card leaves that already-open panel in place.
        await expect(agentPanel.root).toBeVisible()
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

    test('shows the consent card when a button-click read fails after the automatic load exit', async ({
      comfyPage,
      agentPanel,
      consentTelemetry
    }) => {
      const page = comfyPage.page
      await page.route(
        `**/api/global-settings/${AGENT_CONSENT_SETTING_ID}`,
        (route) => route.fulfill({ status: 500, body: '{"code":"INTERNAL"}' })
      )
      await comfyPage.workflow.reloadAndWaitForApp()

      await expect
        .poll(() =>
          consentTelemetry
            .filter((e) => e.event === 'app:agent_consent_offer_exited')
            .map((e) => [e.properties.stage, e.properties.exit])
        )
        .toContainEqual(['load', 'consent_read_failed'])

      await expect(agentPanel.root).toBeVisible()
      await expect(agentPanel.openButton).toBeEnabled()
      await agentPanel.openButton.click()
      await expect(agentPanel.root).toHaveCount(0)
      await agentPanel.openButton.click()

      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('alert')).toContainText(
        enMessages.agent.consent.loadErrorTitle
      )
      expect(
        consentTelemetry.filter(
          (e) =>
            e.event === 'app:agent_consent_offer_exited' &&
            e.properties.stage === 'request'
        )
      ).toEqual([])
      await expect(agentPanel.root).toHaveCount(0)
    })
  }
)
