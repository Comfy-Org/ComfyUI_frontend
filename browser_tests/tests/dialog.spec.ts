import { expect } from '@playwright/test'

import type { Keybinding } from '../../src/platform/keybindings/types'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { DefaultGraphPositions } from '../fixtures/constants/defaultGraphPositions'
import { TestIds } from '../fixtures/selectors'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Missing nodes in Error Overlay', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  test('Should show error overlay when loading a workflow with missing nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()

    const missingNodesTitle = comfyPage.page.getByText(/Missing Node Packs/)
    await expect(missingNodesTitle).toBeVisible()
  })

  test('Should show error overlay when loading a workflow with missing nodes in subgraphs', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes_in_subgraph')

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()

    const missingNodesTitle = comfyPage.page.getByText(/Missing Node Packs/)
    await expect(missingNodesTitle).toBeVisible()

    // Click "See Errors" to open the errors tab and verify subgraph node content
    await errorOverlay.getByRole('button', { name: 'See Errors' }).click()
    await expect(errorOverlay).not.toBeVisible()

    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.dialogs.missingNodeCard
    )
    await expect(missingNodeCard).toBeVisible()

    // Expand the pack group row to reveal node type names
    await missingNodeCard
      .getByRole('button', { name: /expand/i })
      .first()
      .click()
    await expect(
      missingNodeCard.getByText('MISSING_NODE_TYPE_IN_SUBGRAPH')
    ).toBeVisible()
  })

  test('Should show MissingNodeCard in errors tab when clicking See Errors', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()

    // Click "See Errors" to open the right side panel errors tab
    await errorOverlay.getByRole('button', { name: 'See Errors' }).click()
    await expect(errorOverlay).not.toBeVisible()

    // Verify MissingNodeCard is rendered in the errors tab
    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.dialogs.missingNodeCard
    )
    await expect(missingNodeCard).toBeVisible()
  })
})

test('Does not resurface missing nodes on undo/redo', async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  await comfyPage.settings.setSetting(
    'Comfy.RightSidePanel.ShowErrorsTab',
    true
  )
  await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

  const errorOverlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
  await expect(errorOverlay).toBeVisible()

  // Dismiss the error overlay
  await errorOverlay.getByRole('button', { name: 'Dismiss' }).click()
  await expect(errorOverlay).not.toBeVisible()

  // Make a change to the graph by moving a node
  await comfyPage.canvas.click()
  await comfyPage.nextFrame()
  await comfyPage.page.keyboard.press('Control+a')
  await comfyPage.page.mouse.move(400, 300)
  await comfyPage.page.mouse.down()
  await comfyPage.page.mouse.move(450, 350, { steps: 5 })
  await comfyPage.page.mouse.up()
  await comfyPage.nextFrame()

  // Undo and redo should not resurface the error overlay
  await comfyPage.keyboard.undo()
  await expect(errorOverlay).not.toBeVisible({ timeout: 5000 })

  await comfyPage.keyboard.redo()
  await expect(errorOverlay).not.toBeVisible({ timeout: 5000 })
})

test.describe('Execution error', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.setup()
  })

  test('Should display an error message when an execution error occurs', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/execution_error')
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')
    await comfyPage.nextFrame()

    // Wait for the error overlay to be visible
    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()
  })
})

test.describe('Missing models in Error Tab', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    const cleanupOk = await comfyPage.page.evaluate(async (url: string) => {
      const response = await fetch(`${url}/api/devtools/cleanup_fake_model`)
      return response.ok
    }, comfyPage.url)
    expect(cleanupOk).toBeTruthy()
  })

  test('Should show error overlay with missing models when workflow has missing models', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_models')

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()

    const missingModelsTitle = comfyPage.page.getByText(/Missing Models/)
    await expect(missingModelsTitle).toBeVisible()
  })

  test('Should show missing models from node properties', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'missing/missing_models_from_node_properties'
    )

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()

    const missingModelsTitle = comfyPage.page.getByText(/Missing Models/)
    await expect(missingModelsTitle).toBeVisible()
  })

  test('Should not show missing models when widget values have changed', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'missing/model_metadata_widget_mismatch'
    )

    const missingModelsTitle = comfyPage.page.getByText(/Missing Models/)
    await expect(missingModelsTitle).not.toBeVisible()

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).not.toBeVisible()
  })

  // Flaky test after parallelization
  // https://github.com/Comfy-Org/ComfyUI_frontend/pull/1400
  test.skip('Should download missing model when clicking download button', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_models')

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()

    const downloadAllButton = comfyPage.page.getByText('Download all')
    await expect(downloadAllButton).toBeVisible()
    const downloadPromise = comfyPage.page.waitForEvent('download')
    await downloadAllButton.click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('fake_model.safetensors')
  })
})

test.describe('Settings', () => {
  test('@mobile Should be visible on mobile', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()
    const contentArea = settingsDialog.locator('main')
    await expect(contentArea).toBeVisible()
    const isUsableHeight = await contentArea.evaluate(
      (el) => el.clientHeight > 30
    )
    expect(isUsableHeight).toBeTruthy()
  })

  test('Can open settings with hotkey', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.down('ControlOrMeta')
    await comfyPage.page.keyboard.press(',')
    await comfyPage.page.keyboard.up('ControlOrMeta')
    const settingsLocator = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsLocator).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(settingsLocator).not.toBeVisible()
  })

  test('Can change canvas zoom speed setting', async ({ comfyPage }) => {
    const maxSpeed = 2.5
    await comfyPage.settings.setSetting('Comfy.Graph.ZoomSpeed', maxSpeed)
    await test.step('Setting should persist', async () => {
      expect(await comfyPage.settings.getSetting('Comfy.Graph.ZoomSpeed')).toBe(
        maxSpeed
      )
    })
  })

  test('Should persist keybinding setting', async ({ comfyPage }) => {
    // Open the settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    await comfyPage.page.waitForSelector('[data-testid="settings-dialog"]')

    // Open the keybinding tab
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await settingsDialog
      .locator('nav [role="button"]', { hasText: 'Keybinding' })
      .click()
    await comfyPage.page.waitForSelector(
      '[placeholder="Search Keybindings..."]'
    )

    // Focus the 'New Blank Workflow' row
    const newBlankWorkflowRow = comfyPage.page.locator('tr', {
      has: comfyPage.page.getByRole('cell', { name: 'New Blank Workflow' })
    })
    await newBlankWorkflowRow.click()

    // Click add keybinding button (New Blank Workflow has no default keybinding)
    const addKeybindingButton = newBlankWorkflowRow.locator(
      '.icon-\\[lucide--plus\\]'
    )
    await addKeybindingButton.click()

    // Set new keybinding
    const input = comfyPage.page.getByPlaceholder('Enter your keybind')
    await input.press('Alt+n')

    const requestPromise = comfyPage.page.waitForRequest(
      (req) =>
        req.url().includes('/api/settings') &&
        !req.url().includes('/api/settings/') &&
        req.method() === 'POST'
    )

    // Save keybinding
    const saveButton = comfyPage.page
      .getByLabel('Modify keybinding')
      .getByText('Save')
    await saveButton.click()

    const request = await requestPromise
    const expectedSetting: Keybinding = {
      commandId: 'Comfy.NewBlankWorkflow',
      combo: {
        key: 'n',
        ctrl: false,
        alt: true,
        shift: false
      }
    }
    expect(request.postData()).toContain(JSON.stringify(expectedSetting))
  })
})

test.describe('Support', () => {
  test('Should open external zendesk link with OSS tag', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

    // Prevent loading the external page
    await comfyPage.page
      .context()
      .route('https://support.comfy.org/**', (route) =>
        route.fulfill({ body: '<html></html>', contentType: 'text/html' })
      )

    const popupPromise = comfyPage.page.waitForEvent('popup')
    await comfyPage.menu.topbar.triggerTopbarCommand(['Help', 'Support'])
    const popup = await popupPromise

    const url = new URL(popup.url())
    expect(url.hostname).toBe('support.comfy.org')
    expect(url.searchParams.get('tf_42243568391700')).toBe('oss')

    await popup.close()
  })
})

test.describe('Error dialog', () => {
  test('Should display an error dialog when graph configure fails', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      const graph = window.graph!
      ;(graph as { configure: () => void }).configure = () => {
        throw new Error('Error on configure!')
      }
    })

    await comfyPage.workflow.loadWorkflow('default')

    const errorDialog = comfyPage.page.locator('.comfy-error-report')
    await expect(errorDialog).toBeVisible()
  })

  test('Should display an error dialog when prompt execution fails', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(async () => {
      const app = window.app!
      app.api.queuePrompt = () => {
        throw new Error('Error on queuePrompt!')
      }
      await app.queuePrompt(0)
    })
    const errorDialog = comfyPage.page.locator('.comfy-error-report')
    await expect(errorDialog).toBeVisible()
  })
})

test.describe('Signin dialog', () => {
  test('Paste content to signin dialog should not paste node on canvas', async ({
    comfyPage
  }) => {
    const nodeNum = await comfyPage.nodeOps.getNodeCount()
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick
    })
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.clipboard.copy()

    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('test_password')
    await textBox.press('Control+a')
    await textBox.press('Control+c')

    await comfyPage.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showSignInDialog()
    })

    const input = comfyPage.page.locator('#comfy-org-sign-in-password')
    await input.waitFor({ state: 'visible' })
    await input.press('Control+v')
    await expect(input).toHaveValue('test_password')

    expect(await comfyPage.nodeOps.getNodeCount()).toBe(nodeNum)
  })
})
