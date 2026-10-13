import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { test } from '@e2e/tests/agent/agentCreditsExhaustionLifecycleMocks'

test.describe(
  'Agent standing credits-exhaustion lifecycle',
  { tag: ['@cloud', '@screenshot', '@ui'] },
  () => {
    test.use({
      connectWebSocketToServer: false,
      initialFeatureFlags: { enable_telemetry: true }
    })

    test('refreshes, survives remount, recovers, re-arms, and warns when the Agent grant runs out', async ({
      agentBilling,
      agentPanel,
      creditsLifecycle,
      hostTelemetry
    }) => {
      const paywall = agentPanel.creditsExhaustedPaywall
      const sendButton = agentPanel.sendButton
      const notice = agentPanel.creditTransitionNotice
      const noticeEvents = () =>
        hostTelemetry.filter(
          ({ event }) => event === 'app:agent_credit_transition_notice'
        )

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('show exhaustion after a successful turn', async () => {
        await creditsLifecycle.completeTurn('Build a red fox workflow', {
          fundingState: 'exhausted'
        })
        await expect(sendButton).toBeVisible()
        await expect(paywall).toBeVisible()
        await expect(paywall).toContainText(
          enMessages.agent.paywall.body.subscribed
        )
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText(['Build a red fox workflow'])
      })

      await test.step('preserve exhaustion across a panel remount', async () => {
        await agentPanel.close()
        await agentPanel.open()
        await expect(paywall).toBeVisible()
      })

      await test.step('apply accepted-turn recovery while the panel is closed', async () => {
        const heldRefresh = agentBilling.holdNextFundedRefresh()
        const completedTurn = creditsLifecycle.completeTurn(
          'Make the lighting warmer',
          { fundingState: 'funded' }
        )
        await heldRefresh.entered
        agentBilling.failSubsequentRefreshes()
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText(['Make the lighting warmer'])
        await agentPanel.close()
        heldRefresh.release()
        await heldRefresh.completed
        await completedTurn
        await agentPanel.open()
        await expect(paywall).toHaveCount(0)
        agentBilling.resumeRefreshes()
      })

      await test.step('re-arm exhaustion after another successful turn', async () => {
        await creditsLifecycle.completeTurn('Add shallow depth of field', {
          fundingState: 'exhausted'
        })
        await expect(sendButton).toBeVisible()
        await expect(paywall).toBeVisible()
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText(['Add shallow depth of field'])
      })

      await test.step('recover again and preserve the conversation', async () => {
        await creditsLifecycle.completeTurn('Finish the workflow', {
          fundingState: 'funded'
        })
        await expect(sendButton).toBeVisible()
        await expect(paywall).toHaveCount(0)
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText(['Add shallow depth of field', 'Finish the workflow'])
      })

      await test.step('warn once the Agent grant alone runs out', async () => {
        await creditsLifecycle.completeTurn('Render a final preview', {
          fundingState: 'scopedExhausted'
        })
        await expect(notice).toContainText(
          enMessages.agent.creditTransitionNotice
        )
        await expect(paywall).toHaveCount(0)
        await expect(notice).toHaveScreenshot(
          'agent-credit-transition-notice.png'
        )
        await expect(agentPanel.composerStack).toHaveScreenshot(
          'agent-credit-transition-composer-stack.png'
        )
        await expect.poll(noticeEvents).toEqual([
          {
            event: 'app:agent_credit_transition_notice',
            properties: { action: 'shown' }
          }
        ])
      })

      await test.step('dismiss the warning and keep the composer', async () => {
        await notice
          .getByRole('button', { name: enMessages.agent.dismiss })
          .click()
        await expect(notice).toHaveCount(0)
        await expect(sendButton).toBeVisible()
        await expect.poll(noticeEvents).toEqual([
          {
            event: 'app:agent_credit_transition_notice',
            properties: { action: 'shown' }
          },
          {
            event: 'app:agent_credit_transition_notice',
            properties: { action: 'dismissed' }
          }
        ])
      })
    })
  }
)
