import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { desktopAgentConsentTest as test } from '@e2e/fixtures/desktopAgentConsentFixture'
import {
  AGENT_COACH_SEEN_KEY,
  MESSAGE_DONE_EVENT,
  agentMessageDeltaEvent,
  pushAgentEvent
} from '@e2e/tests/agent/agentPanelMocks'

test.describe('Desktop Agent consent', { tag: ['@desktop', '@ui'] }, () => {
  test.use({
    agentConsentAccepted: false,
    initialLocalStorage: { [AGENT_COACH_SEEN_KEY]: 'true' }
  })

  test('keeps the panel locked after Skip and asks again only on Send', async ({
    comfyPage,
    agentPanel,
    agentConsentWrites,
    postedMessages
  }) => {
    await test.step('Startup shows consent above the open panel', async () => {
      await expect(agentPanel.consentDialog).toBeVisible()
      await expect(agentPanel.root).toBeVisible()
      await expect(
        agentPanel.consentDialog.getByRole('button', {
          name: enMessages.agent.consent.agreeAndContinue
        })
      ).toBeVisible()
      await agentPanel.consentRejectButton.click()
      await expect(agentPanel.consentDialog).toHaveCount(0)
      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(agentPanel.composer).toBeVisible()
      expect(agentConsentWrites).toEqual([])
      expect(postedMessages).toEqual([])
    })

    await test.step('The Agent button only closes and reopens the panel', async () => {
      await agentPanel.openButton.click()
      await expect(agentPanel.root).toHaveCount(0)
      await agentPanel.openButton.click()
      await expect(agentPanel.root).toBeVisible()
      await expect(agentPanel.consentDialog).toHaveCount(0)
    })

    await test.step('The next launch keeps the locked panel without repeating the introduction', async () => {
      await agentPanel.openButton.click()
      await expect(agentPanel.root).toHaveCount(0)
      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      await comfyPage.workflow.reloadAndWaitForApp()
      await expect(agentPanel.root).toBeVisible()
      await expect(agentPanel.consentDialog).toHaveCount(0)
      expect(agentConsentWrites).toEqual([])
    })

    await test.step('Send requests consent while preserving the original draft', async () => {
      await agentPanel.composer.fill('Keep this Desktop draft until consent')
      await agentPanel.sendButton.click()
      await expect(agentPanel.consentDialog).toBeVisible()
      await agentPanel.consentRejectButton.click()
      await expect(agentPanel.composer).toHaveText(
        'Keep this Desktop draft until consent'
      )
      expect(agentConsentWrites).toEqual([])
      expect(postedMessages).toEqual([])
    })
  })

  test('sends the original signed-out submission once after sign-in and confirmed consent persistence', async ({
    comfyPage,
    agentPanel,
    desktopConsentSignIn,
    agentConsentSave,
    agentConsentWrites,
    postedMessages,
    getAgentSocket
  }) => {
    const signIn = comfyPage.page.getByTestId('desktop-host-sso')
    const message = 'Continue this Desktop submission after sign-in'
    let releaseSave = () => {}
    agentConsentSave.pending = new Promise<void>((resolve) => {
      releaseSave = resolve
    })

    try {
      await test.step('Skip the introduction and submit a draft', async () => {
        await expect(agentPanel.consentDialog).toBeVisible()
        await agentPanel.consentRejectButton.click()
        await agentPanel.composer.fill(message)
        await agentPanel.sendButton.click()
        await expect(agentPanel.consentDialog).toBeVisible()
      })

      await test.step('Agree opens sign-in without saving or sending', async () => {
        await agentPanel.consentDialog
          .getByRole('button', {
            name: enMessages.agent.consent.agreeAndContinue
          })
          .click()
        await expect(signIn).toBeVisible()
        await signIn.click()
        await expect.poll(() => desktopConsentSignIn.requests).toBe(1)
        expect(agentConsentWrites).toEqual([])
        expect(postedMessages).toEqual([])
      })

      await test.step('Successful sign-in starts saving without repeating Agree or sending early', async () => {
        desktopConsentSignIn.complete()
        await expect.poll(() => agentConsentWrites).toEqual([true])
        await expect(signIn).toHaveCount(0)
        await expect(agentPanel.consentDialog).toHaveCount(0)
        expect(postedMessages).toEqual([])
      })

      await test.step('Confirmed persistence resumes the original message exactly once', async () => {
        releaseSave()
        await expect.poll(() => postedMessages.length).toBe(1)
        expect(JSON.parse(postedMessages[0])).toMatchObject({
          content: message
        })
        await expect(agentPanel.composer).toBeEmpty()
        const socket = await getAgentSocket()
        pushAgentEvent(socket, agentMessageDeltaEvent('Desktop turn completed'))
        pushAgentEvent(socket, MESSAGE_DONE_EVENT)
        await expect(
          agentPanel.root.getByText('Desktop turn completed', { exact: true })
        ).toBeVisible()
        await expect(agentPanel.sendButton).toBeVisible()
        await expect(agentPanel.consentDialog).toHaveCount(0)
        expect(agentConsentWrites).toEqual([true])
        expect(postedMessages).toHaveLength(1)
      })
    } finally {
      desktopConsentSignIn.complete()
      releaseSave()
    }
  })
})
