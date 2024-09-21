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
    await comfyPage.page.evaluate((url: string) => {
      return fetch(`${url}/api/devtools/cleanup_fake_model`)
    }, comfyPage.url)
    await comfyPage.setSetting('Comfy.Workflow.ModelDownload.AllowedSources', [
      'http://localhost:8188'
    ])
    await comfyPage.setSetting('Comfy.Workflow.ModelDownload.AllowedSuffixes', [
      '.safetensors'
    ])
  })

  test('Should display a warning when missing models are found', async ({
    comfyPage
  }) => {
    await comfyPage.setSetting('Comfy.Workflow.ShowMissingModelsWarning', true)

    // The fake_model.safetensors is served by
    // https://github.com/Comfy-Org/ComfyUI_devtools/blob/main/__init__.py
    await comfyPage.loadWorkflow('missing_models')

    // Wait for the element with the .comfy-missing-models selector to be visible
    const missingModelsWarning = comfyPage.page.locator('.comfy-missing-models')
    await expect(missingModelsWarning).toBeVisible()

    // Click the download button
    const downloadButton = comfyPage.page.getByLabel('Download')
    await expect(downloadButton).toBeVisible()
    await downloadButton.click()

    // Wait for the element with the .download-complete selector to be visible
    const downloadComplete = comfyPage.page.locator('.download-complete')
    await expect(downloadComplete).toBeVisible()
  })
})
