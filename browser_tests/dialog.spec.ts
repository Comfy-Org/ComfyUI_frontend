import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Load workflow warning', () => {
  test('Should display a warning when loading a workflow with missing nodes', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('missing_nodes')

    // Wait for the element with the .comfy-missing-nodes selector to be visible
    const missingNodesWarning = comfyPage.page.locator('.comfy-missing-nodes')
    await expect(missingNodesWarning).toBeVisible()
  })
})

test('Does not report warning on undo/redo', async ({ comfyPage }) => {
  await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')

  await comfyPage.loadWorkflow('missing_nodes')
  await comfyPage.closeDialog()

  // Make a change to the graph
  await comfyPage.doubleClickCanvas()
  await comfyPage.searchBox.fillAndSelectFirstNode('KSampler')

  // Undo and redo the change
  await comfyPage.ctrlZ()
  await expect(comfyPage.page.locator('.comfy-missing-nodes')).not.toBeVisible()
  await comfyPage.ctrlY()
  await expect(comfyPage.page.locator('.comfy-missing-nodes')).not.toBeVisible()
})

test.describe('Execution error', () => {
  test('Should display an error message when an execution error occurs', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('execution_error')
    await comfyPage.queueButton.click()

    // Wait for the element with the .comfy-execution-error selector to be visible
    const executionError = comfyPage.page.locator('.comfy-error-report')
    await expect(executionError).toBeVisible()
  })
})

test.describe('Missing models warning', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Workflow.ShowMissingModelsWarning', true)
    await comfyPage.page.evaluate((url: string) => {
      return fetch(`${url}/api/devtools/cleanup_fake_model`)
    }, comfyPage.url)
  })

  test('Should display a warning when missing models are found', async ({
    comfyPage
  }) => {
    // The fake_model.safetensors is served by
    // https://github.com/Comfy-Org/ComfyUI_devtools/blob/main/__init__.py
    await comfyPage.loadWorkflow('missing_models')

    const missingModelsWarning = comfyPage.page.locator('.comfy-missing-models')
    await expect(missingModelsWarning).toBeVisible()

    const downloadButton = comfyPage.page.getByLabel('Download')
    await expect(downloadButton).toBeVisible()
    await downloadButton.click()

    const downloadComplete = comfyPage.page.locator('.download-complete')
    await expect(downloadComplete).toBeVisible()
  })

  test('Can configure download folder', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('missing_models')

    const missingModelsWarning = comfyPage.page.locator('.comfy-missing-models')
    await expect(missingModelsWarning).toBeVisible()

    const folderSelectToggle = comfyPage.page.locator(
      '.model-path-select-checkbox'
    )
    const folderSelect = comfyPage.page.locator('.model-path-select')
    await expect(folderSelectToggle).toBeVisible()
    await expect(folderSelect).not.toBeVisible()

    await folderSelectToggle.click() // show the selectors
    await expect(folderSelect).toBeVisible()

    await folderSelect.click() // open dropdown
    await expect(folderSelect).toHaveClass(/p-select-open/)

    await folderSelect.click() // close the dropdown
    await expect(folderSelect).not.toHaveClass(/p-select-open/)

    await folderSelectToggle.click() // hide the selectors
    await expect(folderSelect).not.toBeVisible()
  })
})

test.describe('Settings', () => {
  test.afterEach(async ({ comfyPage }) => {
    // Restore default setting value
    await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', 1.1)
  })

  test('@mobile Should be visible on mobile', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const searchBox = comfyPage.page.locator('.settings-content')
    await expect(searchBox).toBeVisible()
  })

  test('Can open settings with hotkey', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.down('ControlOrMeta')
    await comfyPage.page.keyboard.press(',')
    await comfyPage.page.keyboard.up('ControlOrMeta')
    const settingsLocator = comfyPage.page.locator('.settings-container')
    await expect(settingsLocator).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(settingsLocator).not.toBeVisible()
  })

  test('Can change canvas zoom speed setting', async ({ comfyPage }) => {
    const maxSpeed = 2.5
    await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', maxSpeed)
    test.step('Setting should persist', async () => {
      expect(await comfyPage.getSetting('Comfy.Graph.ZoomSpeed')).toBe(maxSpeed)
    })
  })
})
