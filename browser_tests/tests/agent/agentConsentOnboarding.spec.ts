import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'

import { onboardingFixture } from '@e2e/fixtures/tourFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentFeatures, agentTest } from '@e2e/tests/agent/agentPanelMocks'

/**
 * Repro suite for PM-1301 / PM-1308: "Start" on the agent consent card opens
 * the panel but the onboarding coach marks never appear. Each test isolates
 * one hypothesis about the coach's mount gate in AgentPanelRoot.vue:
 *
 *   v-if="consentAccepted && onboardingKey && !linearMode && activeTour === null"
 */

/** The coach's per-user, per-workspace seen-flag (useOnboarding storageKey). */
const SCOPED_ONBOARDED_KEY =
  'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal'
const CONSENT_AUTO_SHOWN_KEY =
  'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal'

/** A template the first-run tour pins roles for, so `?template=` starts it. */
const FIRST_RUN_TEMPLATE_ID = 'image_z_image_turbo'

function scopedOnboardedFlag(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), SCOPED_ONBOARDED_KEY)
}

agentTest.describe(
  'Agent onboarding coach after consent',
  { tag: ['@cloud', '@ui'] },
  () => {
    agentTest.use({
      agentConsentAccepted: false,
      agentOnboardingCompleted: false,
      initialLocalStorage: { [CONSENT_AUTO_SHOWN_KEY]: 'true' }
    })

    agentTest(
      'PM-1308: Start on the consent card opens the onboarding coach',
      async ({ comfyPage, agentPanel }, testInfo) => {
        const page = comfyPage.page
        const consent = page.getByRole('dialog', {
          name: enMessages.agent.consent.title
        })
        const coachSpotlight = page.getByTestId('agent-coach-spotlight')
        const coachCard = page.getByRole('dialog', {
          name: enMessages.agent.coachTitle
        })

        await agentTest.step(
          'Accept consent from the entry button',
          async () => {
            await agentPanel.openButton.click()
            await expect(consent).toBeVisible()
            await consent
              .getByRole('button', { name: enMessages.agent.consent.accept })
              .click()
            await expect(consent).toHaveCount(0)
            await expect(agentPanel.root).toBeVisible()
          }
        )

        await agentTest.step('The coach spotlights the panel', async () => {
          await testInfo.attach('panel-after-start', {
            body: await page.screenshot(),
            contentType: 'image/png'
          })
          await expect(coachSpotlight).toBeVisible()
          await expect(coachCard).toBeVisible()
          await expect(coachCard).toContainText('1 of 4')
        })
      }
    )

    agentTest(
      'Hypothesis B (PM-1308): the coach mounts for the resolved user and workspace scope right after Start',
      async ({ comfyPage, agentPanel }) => {
        const page = comfyPage.page
        const consent = page.getByRole('dialog', {
          name: enMessages.agent.consent.title
        })

        await agentTest.step(
          'No scoped seen-flag exists before consent',
          async () => {
            expect(await scopedOnboardedFlag(page)).toBeNull()
          }
        )

        await agentTest.step('Accept consent', async () => {
          await agentPanel.openButton.click()
          await consent
            .getByRole('button', { name: enMessages.agent.consent.accept })
            .click()
          await expect(agentPanel.root).toBeVisible()
        })

        // useStorage writes its default the moment OnboardingCoach mounts, so
        // the scoped flag turning up as "false" proves the v-if gate passed
        // with a non-null onboardingKey. A key that never appears means the
        // coach never mounted for this scope.
        await agentTest.step(
          'The coach mounted under the scoped key',
          async () => {
            await expect.poll(() => scopedOnboardedFlag(page)).toBe('false')
          }
        )
      }
    )

    /**
     * Before the seen-flag was scoped per user and workspace, every agent
     * open wrote the device-wide `Comfy.AgentPanel.onboarded`. A user who
     * used the agent before the consent card shipped carries that flag, and
     * `adoptSharedOnboardingFlag` moves it onto the first scope they consent
     * in, so Start opens the panel with no guide.
     */
    agentTest.describe(
      'on a device that showed the coach before consent shipped',
      () => {
        agentTest.use({ agentOnboardingCompleted: true })

        agentTest(
          'Hypothesis D (PM-1308): Start opens the coach for a scope that never saw it',
          async ({ comfyPage, agentPanel }, testInfo) => {
            agentTest.fail(
              true,
              'PM-1301 / PM-1308: adoptSharedOnboardingFlag marks the first consented scope seen from the legacy device flag, so Start opens the panel without the guide'
            )
            const page = comfyPage.page
            const consent = page.getByRole('dialog', {
              name: enMessages.agent.consent.title
            })
            const coachSpotlight = page.getByTestId('agent-coach-spotlight')

            await agentTest.step(
              'Only the legacy device-wide flag exists',
              async () => {
                expect(await scopedOnboardedFlag(page)).toBeNull()
                expect(
                  await page.evaluate(() =>
                    localStorage.getItem('Comfy.AgentPanel.onboarded')
                  )
                ).toBe('true')
              }
            )

            await agentTest.step('Accept consent', async () => {
              await agentPanel.openButton.click()
              await consent
                .getByRole('button', { name: enMessages.agent.consent.accept })
                .click()
              await expect(agentPanel.root).toBeVisible()
            })

            await agentTest.step('The coach spotlights the panel', async () => {
              await testInfo.attach('panel-after-start', {
                body: await page.screenshot(),
                contentType: 'image/png'
              })
              await expect(coachSpotlight).toBeVisible()
            })
          }
        )
      }
    )
  }
)

/**
 * A user new to the whole app: `?template=` starts the first-run tour on boot
 * and the agent consent card auto-offers itself over it. The coach's mount
 * gate defers to the general tour (`activeTour === null`), so it must hand
 * over once that tour ends.
 *
 * The consent read is held until the test releases it: loading the template
 * closes whatever dialog is active (useTemplateWorkflows), so an offer that
 * lands first is swept away before the tour starts. Releasing it once the
 * tour is up is the slow-network ordering that puts the card over the tour.
 */
const firstRunTest = mergeTests(agentTest, onboardingFixture).extend<{
  consentReadHold: { released: Promise<void>; release: () => void }
}>({
  consentReadHold: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    let release = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    await use({ released, release })
  },
  page: async ({ page, agentFlagEnabled, consentReadHold }, use) => {
    // Registered after agentPanelMocks' routes, so these win.
    await page.route(
      `**/api/global-settings/${AGENT_CONSENT_SETTING_ID}`,
      async (route) => {
        await consentReadHold.released
        await route.fallback()
      }
    )
    await page.route('**/api/settings', (route) =>
      route.fulfill(jsonRoute({ 'Comfy.RightSidePanel.ShowErrorsTab': false }))
    )
    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({
          ...agentFeatures(agentFlagEnabled),
          onboarding_tour_enabled: true,
          subscription_required: true
        })
      )
    )
    // The template needs real node definitions to load.
    await page.route('**/api/object_info', (route) => route.fallback())
    await use(page)
  }
})

firstRunTest.describe(
  'Agent onboarding coach during the first-run tour',
  { tag: ['@cloud', '@ui'] },
  () => {
    firstRunTest.use({
      agentConsentAccepted: false,
      agentOnboardingCompleted: false,
      initialUrl: `/?template=${FIRST_RUN_TEMPLATE_ID}`
    })

    firstRunTest(
      'Hypothesis A (PM-1308): the coach appears once the first-run tour ends after consent was accepted mid-tour',
      async (
        { comfyPage, agentPanel, onboarding, consentReadHold },
        testInfo
      ) => {
        firstRunTest.slow()
        const page = comfyPage.page
        const consent = page.getByRole('dialog', {
          name: enMessages.agent.consent.title
        })
        const coachSpotlight = page.getByTestId('agent-coach-spotlight')

        await firstRunTest.step(
          'The consent offer lands over the running first-run tour',
          async () => {
            await expect(onboarding.spotlight).toBeVisible()
            consentReadHold.release()
            await expect(consent).toBeVisible()
            await expect(onboarding.spotlight).toBeVisible()
          }
        )

        await firstRunTest.step(
          'Start opens the panel while the tour keeps running',
          async () => {
            await consent
              .getByRole('button', { name: enMessages.agent.consent.accept })
              .click()
            await expect(consent).toHaveCount(0)
            await expect(agentPanel.root).toBeVisible()
            await expect(
              onboarding.spotlight,
              'opening the panel must not end the first-run tour'
            ).toBeVisible()
            await expect(
              coachSpotlight,
              'the coach yields to the running tour'
            ).toHaveCount(0)
            await testInfo.attach('panel-open-during-tour', {
              body: await page.screenshot(),
              contentType: 'image/png'
            })
          }
        )

        await firstRunTest.step(
          'Skipping the tour hands over to the coach',
          async () => {
            await onboarding.card
              .getByRole('button', {
                name: enMessages.onboardingCoachmarks.skip
              })
              .click()
            await expect(onboarding.spotlight).toBeHidden()
            await testInfo.attach('after-tour-skipped', {
              body: await page.screenshot(),
              contentType: 'image/png'
            })
            await expect(coachSpotlight).toBeVisible()
            await expect(
              page.getByRole('dialog', { name: enMessages.agent.coachTitle })
            ).toBeVisible()
          }
        )
      }
    )
  }
)
