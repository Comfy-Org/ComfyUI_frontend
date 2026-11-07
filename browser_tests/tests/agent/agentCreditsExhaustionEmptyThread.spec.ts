import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent standing credits-exhaustion on an empty thread',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('waits for the first user message before showing the out-of-credits card', async ({
      agentBilling,
      agentPanel,
      page
    }) => {
      const paywall = agentPanel.creditsExhaustedPaywall

      agentBilling.setFundingState('exhausted')
      const exhaustedStatus = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/billing/status'
      )
      await page.reload()
      await waitForCloudApp(page)
      await exhaustedStatus
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('stay hidden on the empty thread', async () => {
        await expect(agentPanel.composer).toBeVisible()
        await expect(paywall).toHaveCount(0)
      })

      await test.step('show once the first message activates the thread', async () => {
        await agentPanel.sendMessage('Build a red fox workflow')
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText(['Build a red fox workflow'])
        await expect(paywall).toBeVisible()
      })

      await test.step('hide again on a new empty thread', async () => {
        await agentPanel.root
          .getByRole('button', { name: enMessages.agent.newChat })
          .click()
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveCount(0)
        await expect(paywall).toHaveCount(0)
      })
    })

    test.describe('credits granted at admission', () => {
      let admittedRefresh: {
        entered: Promise<void>
        completed: Promise<void>
        release: () => void
      }

      test.use({
        initialFeatureFlags: {
          'agent-free-use-message-placement': 'near-composer'
        }
      })

      test.beforeEach(async ({ agentBilling, comfyPage }) => {
        const { page } = comfyPage
        agentBilling.setFundingState('exhausted')
        const exhaustedStatus = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            new URL(response.url()).pathname === '/api/billing/status'
        )
        await page.reload()
        await waitForCloudApp(page)
        await exhaustedStatus
        admittedRefresh = agentBilling.holdNextFundedRefresh()
        await page.route('**/api/agent/threads/*/messages', (route) => {
          if (route.request().method() === 'POST') {
            agentBilling.setFundingState('funded')
          }
          return route.fallback()
        })
      })

      test('keeps the card hidden when the first send is admitted on credits granted at admission', async ({
        agentPanel
      }) => {
        const paywall = agentPanel.creditsExhaustedPaywall

        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await expect(agentPanel.composer).toBeVisible()

        await agentPanel.sendMessage('Generate a realistic portrait')
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText(['Generate a realistic portrait'])
        await admittedRefresh.entered
        await expect(paywall).toHaveCount(0)
        admittedRefresh.release()
        await admittedRefresh.completed
        await expect(
          agentPanel.root.getByRole('note', { name: 'Free use notice' })
        ).toBeVisible()
        await expect(paywall).toHaveCount(0)
      })
    })
  }
)
