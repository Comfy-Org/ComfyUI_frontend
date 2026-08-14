import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ApiSignin } from '@e2e/fixtures/components/ApiSignin'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBalance } from '@e2e/fixtures/data/subscriptionFixtures'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { localAuthFixture } from '@e2e/fixtures/localAuthFixture'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Asset contains a single FluxProUltraImageNode (api_node: true). The
 * display-name assertion tracks the live node def; update it if the backend
 * renames the node.
 */
const PARTNER_WORKFLOW = 'partner_api_node'
const PARTNER_NODE_DISPLAY_NAME = 'Flux 1.1 [pro] Ultra Image'

/**
 * Local/desktop-only run gating: the Run button is replaced when the graph
 * contains partner (api_node) nodes the user cannot run yet. Cloud has its
 * own subscription-driven gating covered by @cloud specs, so these specs
 * intentionally carry no @cloud tag and run in the default local project.
 */
test.describe('Partner nodes run gate (local, signed out)', () => {
  test('replaces Run with "Sign in to run" and opens the partner sign-in dialog', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await expect(page.getByTestId(TestIds.topbar.queueButton)).toBeVisible()

    await comfyPage.workflow.loadWorkflow(PARTNER_WORKFLOW)

    const signInButton = page.getByTestId(
      TestIds.partnerNodes.signInToRunButton
    )
    await expect(signInButton).toBeVisible()
    await expect(page.getByTestId(TestIds.topbar.queueButton)).toHaveCount(0)
    await expect(
      page.getByTestId(TestIds.partnerNodes.runGateCaption)
    ).toContainText('Partner nodes require an account')

    await signInButton.click()
    const dialog = page.getByTestId(TestIds.dialogs.apiSignin)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(PARTNER_NODE_DISPLAY_NAME)).toBeVisible()

    await new ApiSignin(page).cancel.click()
    await expect(dialog).toBeHidden()
    await expect(signInButton).toBeVisible()

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await expect(page.getByTestId(TestIds.topbar.queueButton)).toBeVisible()
    await expect(signInButton).toHaveCount(0)
  })
})

localAuthFixture.describe('Partner nodes run gate (local, signed in)', () => {
  localAuthFixture(
    'gates on "Add Credits" with zero balance and recovers after top-up',
    async ({ comfyPage }) => {
      const page = comfyPage.page

      await comfyPage.workflow.loadWorkflow(PARTNER_WORKFLOW)

      const addCreditsButton = page.getByTestId(
        TestIds.partnerNodes.addCreditsButton
      )
      await expect(addCreditsButton).toBeVisible()
      await expect(page.getByTestId(TestIds.topbar.queueButton)).toHaveCount(0)
      await expect(
        page.getByTestId(TestIds.partnerNodes.runGateCaption)
      ).toContainText('Partner nodes need credits')

      const topUpDialog = new TopUpCreditsDialog(page)
      await addCreditsButton.click()
      await expect(topUpDialog.heading).toBeVisible()
      await topUpDialog.close()

      // Simulate returning from an external Stripe top-up: the balance
      // endpoint now reports funds and the gate refetches on window focus.
      await page.route('**/customers/balance', (r) =>
        r.fulfill(
          jsonRoute(
            createBalance({
              amount_micros: 5_000_000,
              effective_balance_micros: 5_000_000
            })
          )
        )
      )
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))

      await expect(page.getByTestId(TestIds.topbar.queueButton)).toBeVisible()
      await expect(addCreditsButton).toHaveCount(0)
      await expect(
        page.getByTestId(TestIds.partnerNodes.runGateCaption)
      ).toHaveCount(0)
    }
  )
})
