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
      const paywall = agentPanel.creditsExhaustedPaywall
      const sendButton = agentPanel.sendButton

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
    })
  }
)

test.describe(
  'Agent credit-transition notice',
  { tag: ['@cloud', '@screenshot', '@ui'] },
  () => {
    test.use({
      connectWebSocketToServer: false,
      initialFeatureFlags: {
        'agent-free-use-message-placement': 'near-composer',
        enable_telemetry: true
      }
    })

    test('swaps the free-use notice for the workspace-balance notice when the Agent grant runs out', async ({
      agentPanel,
      creditsLifecycle,
      hostTelemetry
    }) => {
      const notice = agentPanel.creditTransitionNotice
      const freeUseNotice = agentPanel.freeUseNotice

      await agentPanel.open()

      await test.step('free-use notice while the Agent grant has funds', async () => {
        await expect(freeUseNotice).toBeVisible()
        await expect(notice).toHaveCount(0)
        await expect(freeUseNotice).toHaveScreenshot(
          'agent-free-use-notice-scoped-funded.png'
        )
      })

      await agentPanel.selectWorkflow()

      await test.step('exhausting the grant alone shows the transition notice', async () => {
        await creditsLifecycle.completeTurn('Build a red fox workflow', {
          fundingState: 'scopedExhausted'
        })

        await expect(notice).toBeVisible()
        await expect(notice).toContainText(
          enMessages.agent.creditTransitionNotice
        )
        await expect(notice).toHaveScreenshot(
          'agent-credit-transition-notice.png'
        )
        await expect
          .poll(() =>
            hostTelemetry.filter(
              ({ event }) => event === 'app:agent_credit_transition_notice'
            )
          )
          .toEqual([
            {
              event: 'app:agent_credit_transition_notice',
              properties: { action: 'shown' }
            }
          ])
      })

      await test.step('the transition notice replaces free-use copy without a paywall', async () => {
        await expect(freeUseNotice).toHaveCount(0)
        await expect(agentPanel.creditsExhaustedPaywall).toHaveCount(0)
        await expect(agentPanel.composerStack).toHaveScreenshot(
          'agent-credit-transition-composer-stack.png'
        )
      })

      await test.step('dismissing it leaves the composer in place', async () => {
        await notice
          .getByRole('button', { name: enMessages.agent.dismiss })
          .click()

        await expect(notice).toHaveCount(0)
        await expect
          .poll(() =>
            hostTelemetry.filter(
              ({ event }) => event === 'app:agent_credit_transition_notice'
            )
          )
          .toEqual([
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
