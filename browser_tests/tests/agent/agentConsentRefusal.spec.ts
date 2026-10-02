import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { AGENT_CONSENT_OFFER_DECLINED_SETTING_ID } from '@/platform/settings/constants/agent'

import { agentConsentTest as test } from '@e2e/fixtures/agentConsentFixture'

const AUTO_SHOWN_KEY = 'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal'
const COACH_SEEN_KEY = 'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal'

/**
 * PM-1910. The reporter pressed Reject three times from three browser profiles
 * and the agent offered itself again each time, because the only record of a
 * refusal was a device-local `localStorage` one-shot: the account remembered an
 * acceptance and forgot a refusal. Jo ruled that an explicit refusal must stop
 * the automatic promotion, and that the card may come back when the user
 * explicitly tries to send.
 *
 * Covered here and nowhere else: the suppression is only worth anything if it
 * crosses a storage scope, which no unit test can arrange, and the send path's
 * re-offer has to prove that *nothing is posted* before acceptance - a property
 * about the network, asserted against the network.
 */
test.describe(
  'Agent consent refusal outlives the device',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      agentPanelInitiallyOpen: true,
      // The coach marks are a separate surface that genuinely holds the first
      // message until they are finished (`waitForCoachCompletion`), so they are
      // marked seen for this scope to keep every assertion below about consent.
      // Not an assertion weakened: the held-by-coach case is its own behaviour
      // and belongs to whatever spec pins the coach.
      initialLocalStorage: { [COACH_SEEN_KEY]: 'true' }
    })

    test('suppresses the automatic offer on another device, and sends nothing until the user accepts', async ({
      comfyPage,
      agentPanel,
      agentConsentWrites,
      postedMessages
    }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      const reject = dialog.getByRole('button', {
        name: enMessages.agent.consent.reject
      })
      const accept = dialog.getByRole('button', {
        name: enMessages.agent.consent.accept
      })

      await test.step('The automatic offer arrives unprompted and is refused', async () => {
        await expect(dialog).toBeVisible()
        await reject.click()
        await expect(dialog).toHaveCount(0)
        await expect(agentPanel.root).toBeVisible()
        // A refusal is still not consent: nothing may reach the consent record.
        expect(agentConsentWrites).toHaveLength(0)
      })

      await test.step('The refusal is stored against the account, not the device', async () => {
        await expect
          .poll(() =>
            comfyPage.settings.getPersistedSetting(
              AGENT_CONSENT_OFFER_DECLINED_SETTING_ID
            )
          )
          .toBe(true)
      })

      await test.step('Another browser profile is not offered the card again', async () => {
        // Emptying web storage is what makes this a second device rather than a
        // reload. Every durable suppression the product had before this change
        // lived in `Comfy.AgentConsent.AutoShown.<user>.<workspace>`, so a plain
        // reload passes with the old behaviour too and proves nothing; a storage
        // scope with no record of this user is exactly the state PM-1910's
        // reporter was in on each of their three devices.
        //
        // The sign-in is kept rather than cleared, because signing in is what
        // the new device does first - and the account is the scope the refusal is
        // supposed to travel in. Everything else goes, including the one-shot.
        // The coach flag is re-seeded for the reason given on `test.use`.
        await page.evaluate(
          ({ id, coachSeenKey }) => {
            const kept = Object.keys(localStorage)
              .filter(
                (key) => key.startsWith('firebase:') || key === 'Comfy.userId'
              )
              .map((key) => [key, localStorage.getItem(key)] as const)
            localStorage.clear()
            sessionStorage.clear()
            for (const [key, value] of kept)
              if (value !== null) localStorage.setItem(key, value)
            localStorage.setItem('Comfy.userId', id)
            localStorage.setItem(coachSeenKey, 'true')
          },
          { id: comfyPage.id, coachSeenKey: COACH_SEEN_KEY }
        )
        await comfyPage.workflow.reloadAndWaitForApp()

        // Asserted first so a regression reads as "the card came back" rather
        // than as some second-order effect of the card holding the screen.
        await expect(dialog).toHaveCount(0)
        await expect(agentPanel.root).toBeVisible()
        await expect(agentPanel.openButton).toBeEnabled()
        // Nothing offered, so the fresh profile's one attempt is still unspent.
        // If suppression ran after the one-shot was burned instead of before it,
        // this key would read 'true' and clearing the refusal later would leave
        // the user silently un-offerable.
        expect(
          await page.evaluate(
            (key) => localStorage.getItem(key),
            AUTO_SHOWN_KEY
          )
        ).toBeNull()
        expect(agentConsentWrites).toHaveLength(0)
      })

      await test.step('Pressing Send reopens consent and posts nothing', async () => {
        await agentPanel.selectWorkflow()
        await agentPanel.sendMessage('Add an upscaler to this workflow')
        await expect(dialog).toBeVisible()
        expect(postedMessages).toHaveLength(0)
      })

      await test.step('Refusing again still posts nothing, and still suppresses promotion', async () => {
        await reject.click()
        await expect(dialog).toHaveCount(0)
        expect(postedMessages).toHaveLength(0)
        expect(agentConsentWrites).toHaveLength(0)
      })

      await test.step('Accepting records consent and releases the message', async () => {
        await agentPanel.sendMessage('Add an upscaler to this workflow')
        await expect(dialog).toBeVisible()
        expect(postedMessages).toHaveLength(0)

        await accept.click()
        await expect(dialog).toHaveCount(0)
        await expect.poll(() => agentConsentWrites).toEqual([true])
        await expect.poll(() => postedMessages).toHaveLength(1)
        expect(postedMessages[0]).toContain('Add an upscaler to this workflow')
      })
    })
  }
)
