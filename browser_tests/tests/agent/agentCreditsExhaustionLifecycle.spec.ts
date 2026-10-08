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

/**
 * The free Agent grant running out while the workspace balance still funds
 * Agent activity (PM-2005). Distinct from the lifecycle above: no funding is
 * gone, so this is deliberately NOT a paywall. The two surfaces trade places —
 * the FREE-during-BETA notice stops claiming the activity is free, and the
 * transition notice says what it now draws on.
 *
 * The element screenshots are the reviewable artifact for that swap, which no
 * text assertion conveys: a reviewer can see the copy, the warning accent and
 * the dismiss affordance without building the state by hand.
 */
test.describe(
  'Agent credit-transition notice',
  { tag: ['@cloud', '@ui'] },
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
      page
    }) => {
      const notice = agentPanel.root.getByTestId(
        'agent-credit-transition-notice'
      )
      const freeUseNotice = agentPanel.root.getByRole('note', {
        name: enMessages.agent.freeUseNoticeLabel
      })
      const composerFooter = agentPanel.root.locator('footer')

      await agentPanel.open()

      await test.step('free-use notice while the Agent grant has funds', async () => {
        await expect(freeUseNotice).toBeVisible()
        await expect(notice).toHaveCount(0)
        await expect(freeUseNotice).toHaveScreenshot(
          'agent-free-use-notice-scoped-funded.png'
        )
      })

      await agentPanel.selectWorkflow()
      // Selecting a workflow leaves the pointer on its chip, whose PrimeVue
      // tooltip then paints over the notices below and lands in the frame.
      // It is `.p-tooltip`, not `role="tooltip"`, so waiting on the role
      // passes while the tooltip is still on screen.
      await page.mouse.move(0, 0)
      await expect(page.locator('.p-tooltip')).toHaveCount(0)

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
      })

      await test.step('the free-use notice is gone and no paywall replaces it', async () => {
        await expect(freeUseNotice).toHaveCount(0)
        await expect(agentPanel.creditsExhaustedPaywall).toHaveCount(0)
        await expect(agentPanel.sendButton).toBeVisible()
        await expect(composerFooter).toHaveScreenshot(
          'agent-composer-free-use-notice-suppressed.png'
        )
      })

      await test.step('dismissing it leaves the composer in place', async () => {
        await notice
          .getByRole('button', { name: enMessages.agent.dismiss })
          .click()

        await expect(notice).toHaveCount(0)
        await expect(freeUseNotice).toHaveCount(0)
        await expect(agentPanel.creditsExhaustedPaywall).toHaveCount(0)
        await expect(agentPanel.sendButton).toBeVisible()
      })
    })
  }
)
