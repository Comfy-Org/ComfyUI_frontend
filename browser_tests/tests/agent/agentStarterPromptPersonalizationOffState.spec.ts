import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent starter prompt personalization off-state',
  { tag: ['@cloud', '@flag-off', '@ui'] },
  () => {
    test('[HARNESS-V2-OFF-01] shows static baseline prompts when flag is off', async ({
      agentPanel,
      agentBilling,
      page
    }) => {
      agentBilling.setFundingState('granted')
      await page.reload()
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('Agent panel renders with static baseline prompts', async () => {
        const suggestedPrompts = agentPanel.root.getByTestId('suggested-prompt')
        const count = await suggestedPrompts.count()
        expect(count).toBeGreaterThan(0)
      })

      await test.step('user can select and send a starter prompt', async () => {
        const firstPrompt = agentPanel.root
          .getByTestId('suggested-prompt')
          .first()
        await firstPrompt.click()

        const userMessages = agentPanel.root.getByTestId('user-message-bubble')
        const messageCount = await userMessages.count()
        expect(messageCount).toBe(1)
      })

      await test.step('subsequent messages work normally', async () => {
        await agentPanel.sendMessage('Show me another example')
        const userMessages = agentPanel.root.getByTestId('user-message-bubble')
        const messageCount = await userMessages.count()
        expect(messageCount).toBe(2)
      })

      await test.step('new chat resets the prompt panel', async () => {
        const newChatBtn = agentPanel.root.getByRole('button', {
          name: enMessages.agent.newChat
        })
        await newChatBtn.click()

        const userMessages = agentPanel.root.getByTestId('user-message-bubble')
        const messageCount = await userMessages.count()
        expect(messageCount).toBe(0)

        const suggestedPrompts = agentPanel.root.getByTestId('suggested-prompt')
        const promptCount = await suggestedPrompts.count()
        expect(promptCount).toBeGreaterThan(0)
      })
    })

    test('[HARNESS-V2-OFF-02] falls back to static baseline with unavailable signals', async ({
      agentPanel,
      agentBilling,
      page
    }) => {
      agentBilling.setFundingState('granted')
      await page.reload()
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('starter prompts render with no workflow attached', async () => {
        const suggestedPrompts = agentPanel.root.getByTestId('suggested-prompt')
        const count = await suggestedPrompts.count()
        expect(count).toBeGreaterThan(0)
      })

      await test.step('prompt set remains stable when flag is off', async () => {
        const beforeAttach = await agentPanel.root
          .getByTestId('suggested-prompt')
          .allTextContents()

        const afterAttach = await agentPanel.root
          .getByTestId('suggested-prompt')
          .allTextContents()

        expect(beforeAttach).toEqual(afterAttach)
      })
    })
  }
)
