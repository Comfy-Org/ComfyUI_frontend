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
        'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal': 'true'
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
