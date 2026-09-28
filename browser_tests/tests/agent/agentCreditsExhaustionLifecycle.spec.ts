import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { test } from '@e2e/tests/agent/agentCreditsExhaustionLifecycleMocks'

test.describe(
  'Agent standing credits-exhaustion lifecycle',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('refreshes, survives remount, recovers, and re-arms without a send refusal', async ({
      agentBilling,
      agentPanel,
      creditsLifecycle
    }) => {
      const paywall = agentPanel.root.getByRole('alert').filter({
        hasText: enMessages.agent.paywall.title
      })
      const sendButton = agentPanel.root.getByRole('button', {
        name: enMessages.agent.send
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('show exhaustion after a successful turn', async () => {
        await creditsLifecycle.completeTurn('Build a red fox workflow', false)
        await expect(sendButton).toBeVisible()
        await expect(paywall).toBeVisible()
        await expect(paywall).toContainText(
          enMessages.agent.paywall.body.subscribed
        )
      })

      await test.step('preserve exhaustion across a panel remount', async () => {
        await agentPanel.root
          .getByRole('button', { name: enMessages.agent.close })
          .click()
        await expect(agentPanel.root).toHaveCount(0)
        await agentPanel.open()
        await expect(paywall).toBeVisible()
      })

      await test.step('apply accepted-turn recovery while the panel is closed', async () => {
        const heldRefresh = agentBilling.holdNextFundedRefresh()
        const completedTurn = creditsLifecycle.completeTurn(
          'Make the lighting warmer',
          true
        )
        await heldRefresh.entered
        await agentPanel.root
          .getByRole('button', { name: enMessages.agent.close })
          .click()
        await expect(agentPanel.root).toHaveCount(0)
        agentBilling.failSubsequentRefreshes()
        heldRefresh.release()
        await heldRefresh.completed
        await completedTurn
        await agentPanel.open()
        await expect(paywall).toHaveCount(0)
        agentBilling.resumeRefreshes()
      })

      await test.step('re-arm exhaustion after another successful turn', async () => {
        await creditsLifecycle.completeTurn('Add shallow depth of field', false)
        await expect(sendButton).toBeVisible()
        await expect(paywall).toBeVisible()
      })

      await test.step('recover again and preserve the conversation', async () => {
        await creditsLifecycle.completeTurn('Finish the workflow', true)
        await expect(sendButton).toBeVisible()
        await expect(paywall).toHaveCount(0)
        await expect(
          agentPanel.root.getByText('Finish the workflow')
        ).toBeVisible()
      })
    })
  }
)
