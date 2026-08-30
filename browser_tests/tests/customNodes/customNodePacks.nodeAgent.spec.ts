import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  nodeAgentEditorFiles,
  nodeAgentEditorSession,
  testedNodeAgentProposal
} from '@e2e/fixtures/data/customNodeWorkbench'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

test.describe('Custom node Node Agent', { tag: ['@cloud', '@ui'] }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page }) => {
    await setupCloudApp(page, {
      workspace: workspace('personal', 'owner')
    })
    await page.route('**/api/customnodes', async (route) => {
      await route.fulfill({ json: [] })
    })
    await page.route('**/api/customnodes/editor/sessions**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/agent/proposals')) {
        await route.fulfill({ status: 201, json: testedNodeAgentProposal })
        return
      }
      if (path.endsWith('/files')) {
        await route.fulfill({ json: nodeAgentEditorFiles })
        return
      }
      await route.fulfill({
        status: path.endsWith('/sessions') ? 202 : 200,
        json: nodeAgentEditorSession
      })
    })
  })

  test('shows controlled backend test results before applying a proposal', async ({
    page,
    request
  }) => {
    const comfyPage = new ComfyPage(page, request)
    await page.goto(APP_URL)
    await comfyPage.waitForAppReady()

    const closeWarning = page
      .getByRole('alert')
      .getByRole('button', { name: 'Close' })
    if (await closeWarning.isVisible()) await closeWarning.click()
    const closeTemplateDialog = page.getByRole('button', {
      name: 'Close dialog'
    })
    if (await closeTemplateDialog.isVisible()) {
      await closeTemplateDialog.click()
    }

    await comfyPage.menu.nodeLibraryTabV2.open()
    await comfyPage.menu.nodeLibraryTabV2.sidebarContent
      .getByRole('button', { name: 'Custom Nodes', exact: true })
      .click()
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByTestId('custom-node-workbench')).toBeVisible()

    await page
      .getByRole('textbox', {
        name: 'For example: add a color input and use it for the dark checkerboard squares'
      })
      .fill('Add a configurable checkerboard color and test it')
    await page
      .getByRole('button', { name: 'Propose changes', exact: true })
      .click()

    const testResult = page.getByTestId('node-agent-test-result')
    await expect(testResult).toContainText('Backend test passed')
    await expect(testResult).toContainText(
      'Draft node executed successfully with 1 output.'
    )
    await expect(testResult).toContainText('Completed in 2184 ms')
    await expect(testResult).toContainText('Phase: complete')
    await expect(testResult).toContainText('Sandbox: seatbelt')
    await expect(testResult).toContainText('Output 1: IMAGE')
    await expect(
      testResult.getByRole('img', {
        name: 'Draft test preview for output 1'
      })
    ).toBeVisible()
    await expect(page.getByLabel('Node Agent proposed changes')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Apply changes', exact: true })
    ).toBeVisible()
  })
})
