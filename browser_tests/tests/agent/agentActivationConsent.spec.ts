import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent activation consent boundary',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      initialLocalStorage: {
        'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal': 'true',
        'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal': 'true'
      }
    })

    test('opens before consent and resumes the held first send exactly once', async ({
      agentConsentSave,
      agentConsentWrites,
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      await expect(agentPanel.root).toBeVisible()
      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'true'
      )

      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('Build a product photo workflow')
      await agentPanel.sendButton.click()

      const dialog = comfyPage.page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      await expect(dialog).toBeVisible()
      expect(postedMessages).toHaveLength(0)

      let releaseConsentSave = () => {}
      agentConsentSave.pending = new Promise<void>((resolve) => {
        releaseConsentSave = resolve
      })
      await dialog
        .getByRole('button', { name: enMessages.agent.consent.accept })
        .click()

      await expect.poll(() => agentConsentWrites).toEqual([true])
      expect(postedMessages).toHaveLength(0)
      releaseConsentSave()

      await expect(dialog).toHaveCount(0)
      await expect(agentPanel.composer).toHaveText('')
      await expect.poll(() => postedMessages).toHaveLength(1)
    })

    test('keeps a cancelled held draft unsent and lets the user retry', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const page = comfyPage.page
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('Build a product photo workflow')
      await agentPanel.sendButton.click()

      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')

      await expect(dialog).toHaveCount(0)
      expect(postedMessages).toHaveLength(0)
      await expect(agentPanel.composer).toHaveText(
        'Build a product photo workflow'
      )

      await agentPanel.sendButton.click()
      await expect(dialog).toBeVisible()
      await dialog
        .getByRole('button', { name: enMessages.agent.consent.accept })
        .click()
      await expect.poll(() => postedMessages).toHaveLength(1)
    })
  }
)

test.describe(
  'Fresh signed-in Agent consent and tour sequencing',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ agentConsentAccepted: false })

    for (const tourAction of ['finish', 'skip'] as const) {
      test(`resumes one held send after the user ${tourAction === 'finish' ? 'finishes' : 'skips'} the tour`, async ({
        agentPanel,
        comfyPage,
        postedMessages
      }) => {
        const page = comfyPage.page
        const consent = page.getByRole('dialog', {
          name: enMessages.agent.consent.title
        })

        await expect(agentPanel.root).toBeVisible()
        await expect(consent).toHaveCount(0)
        await agentPanel.selectWorkflow()
        await agentPanel.composer.fill('Build a product photo workflow')
        await agentPanel.sendButton.click()

        await expect(consent).toBeVisible()
        expect(postedMessages).toHaveLength(0)
        await consent
          .getByRole('button', { name: enMessages.agent.consent.accept })
          .click()

        const coachTitles = [
          enMessages.agent.coachTitle,
          enMessages.agent.coachWorkflowTitle,
          enMessages.agent.coachGraphTitle,
          enMessages.agent.coachHistoryTitle
        ]
        await expect(
          page.getByRole('dialog', { name: coachTitles[0] })
        ).toBeVisible()
        expect(postedMessages).toHaveLength(0)

        if (tourAction === 'skip') {
          await page
            .getByRole('dialog', { name: coachTitles[0] })
            .getByRole('button', { name: enMessages.agent.skip })
            .click()
        } else {
          for (const [index, title] of coachTitles.entries()) {
            await page
              .getByRole('dialog', { name: title })
              .getByRole('button', {
                name:
                  index === coachTitles.length - 1
                    ? enMessages.onboardingCoachmarks.done
                    : enMessages.g.next
              })
              .click()
          }
        }

        await expect.poll(() => postedMessages).toHaveLength(1)
        await agentPanel.openButton.click()
        await expect(agentPanel.root).toHaveCount(0)
        await agentPanel.openButton.click()
        await expect(agentPanel.root).toBeVisible()
        await expect(consent).toHaveCount(0)
        await expect.poll(() => postedMessages).toHaveLength(1)
      })
    }

    test('resumes the held send when App Mode defers the active tour', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const page = comfyPage.page
      const consent = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      const coach = page.getByRole('dialog', {
        name: enMessages.agent.coachTitle
      })

      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('Build a product photo workflow')
      await agentPanel.sendButton.click()
      await consent
        .getByRole('button', { name: enMessages.agent.consent.accept })
        .click()

      await expect(coach).toBeVisible()
      expect(postedMessages).toHaveLength(0)
      await comfyPage.command.executeCommand('Comfy.ToggleLinear')

      await expect(coach).toHaveCount(0)
      await expect.poll(() => postedMessages).toHaveLength(1)
    })
  }
)

test.describe(
  'Agent activation with existing consent',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ agentConsentAccepted: true })

    test('opens on activation and sends without another consent prompt', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      await expect(agentPanel.root).toBeVisible()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('Build a product photo workflow')
      await agentPanel.sendButton.click()

      await expect(
        comfyPage.page.getByRole('dialog', {
          name: enMessages.agent.consent.title
        })
      ).toHaveCount(0)
      await expect.poll(() => postedMessages).toHaveLength(1)
    })
  }
)

test.describe(
  'Agent activation with a persisted open preference',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      agentPanelInitiallyOpen: true,
      initialLocalStorage: {
        'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal': 'true'
      }
    })

    test('keeps the restored panel visible before consent', async ({
      agentPanel
    }) => {
      await expect(agentPanel.root).toBeVisible()
      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })
  }
)
