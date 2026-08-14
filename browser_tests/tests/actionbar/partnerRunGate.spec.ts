import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ApiSignin } from '@e2e/fixtures/components/ApiSignin'
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
 * own subscription-driven gating covered by @cloud specs, so this spec
 * intentionally carries no @cloud tag and runs in the default local project.
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
