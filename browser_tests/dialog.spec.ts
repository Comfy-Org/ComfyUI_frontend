import { expect } from '@playwright/test'

import { Keybinding } from '../src/types/keyBindingTypes'
import { comfyPageFixture as test } from './fixtures/ComfyPage'

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
    await comfyPage.nextFrame()

    // Wait for the element with the .comfy-execution-error selector to be visible
    const executionError = comfyPage.page.locator('.comfy-error-report')
    await expect(executionError).toBeVisible()
  })

  test('Can display Issue Report form', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('execution_error')
    await comfyPage.queueButton.click()
    await comfyPage.nextFrame()

    await comfyPage.page.getByLabel('Help Fix This').click()
    const issueReportForm = comfyPage.page.getByText(
      'Submit Error Report (Optional)'
    )
    await expect(issueReportForm).toBeVisible()
  })
})

test.describe('Missing models warning', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Workflow.ShowMissingModelsWarning', true)
    await comfyPage.page.evaluate((url: string) => {
      return fetch(`${url}/api/devtools/cleanup_fake_model`)
    }, comfyPage.url)
  })

  // Flaky test after parallelization
  // https://github.com/Comfy-Org/ComfyUI_frontend/pull/1400
  test.skip('Should display a warning when missing models are found', async ({
    comfyPage
  }) => {
    // The fake_model.safetensors is served by
    // https://github.com/Comfy-Org/ComfyUI_devtools/blob/main/__init__.py
    await comfyPage.loadWorkflow('missing_models')

    const missingModelsWarning = comfyPage.page.locator('.comfy-missing-models')
    await expect(missingModelsWarning).toBeVisible()

    const downloadButton = comfyPage.page.getByLabel('Download')
    await expect(downloadButton).toBeVisible()
    const downloadPromise = comfyPage.page.waitForEvent('download')
    await downloadButton.click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('fake_model.safetensors')
  })
})

test.describe('Settings', () => {
  test('@mobile Should be visible on mobile', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsContent = comfyPage.page.locator('.settings-content')
    await expect(settingsContent).toBeVisible()
    const isUsableHeight = await settingsContent.evaluate(
      (el) => el.clientHeight > 30
    )
    expect(isUsableHeight).toBeTruthy()
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
    await test.step('Setting should persist', async () => {
      expect(await comfyPage.getSetting('Comfy.Graph.ZoomSpeed')).toBe(maxSpeed)
    })
  })

  test('Should persist keybinding setting', async ({ comfyPage }) => {
    // Open the settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    await comfyPage.page.waitForSelector('.settings-container')

    // Open the keybinding tab
    await comfyPage.page.getByLabel('Keybinding').click()
    await comfyPage.page.waitForSelector(
      '[placeholder="Search Keybindings..."]'
    )

    // Focus the 'New Blank Workflow' row
    const newBlankWorkflowRow = comfyPage.page.locator('tr', {
      has: comfyPage.page.getByRole('cell', { name: 'New Blank Workflow' })
    })
    await newBlankWorkflowRow.click()

    // Click edit button
    const editKeybindingButton = newBlankWorkflowRow.locator('.pi-pencil')
    await editKeybindingButton.click()

    // Set new keybinding
    const input = comfyPage.page.getByPlaceholder('Press keys for new binding')
    await input.press('Alt+n')

    const requestPromise = comfyPage.page.waitForRequest(
      '**/api/settings/Comfy.Keybinding.NewBindings'
    )

    // Save keybinding
    const saveButton = comfyPage.page
      .getByLabel('Comfy.NewBlankWorkflow')
      .getByLabel('Save')
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

test.describe('Feedback dialog', () => {
  test('Should open from about panel badgeand', async ({ comfyPage }) => {
    // Go to about panel page in settings
    const settings = comfyPage.settingDialog
    await settings.open()
    await settings.goToAboutPanel()

    // Click feedback button
    const feedbackButton = settings.root
      .locator('a')
      .filter({ hasText: 'Feedback' })
    await feedbackButton.click({ force: true })

    // Verify feedback dialog content is visible
    const feedbackHeader = comfyPage.page.getByRole('heading', {
      name: 'Feedback'
    })
    await expect(feedbackHeader).toBeVisible()
  })

  test('Should open from topmenu help command', async ({ comfyPage }) => {
    // Open feedback dialog from top menu
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.menu.topbar.triggerTopbarCommand(['Help', 'Feedback'])

    // Verify feedback dialog content is visible
    const feedbackHeader = comfyPage.page.getByRole('heading', {
      name: 'Feedback'
    })
    await expect(feedbackHeader).toBeVisible()
  })

  test('Should close when close button clicked', async ({ comfyPage }) => {
    // Open feedback dialog
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.menu.topbar.triggerTopbarCommand(['Help', 'Feedback'])

    const feedbackHeader = comfyPage.page.getByRole('heading', {
      name: 'Feedback'
    })

    // Close feedback dialog
    await comfyPage.page
      .getByLabel('', { exact: true })
      .getByLabel('Close')
      .click()
    await feedbackHeader.waitFor({ state: 'hidden' })

    // Verify dialog is closed
    await expect(feedbackHeader).not.toBeVisible()
  })

  test('Should update rating icons when selecting rating', async ({
    comfyPage
  }) => {
    // Open feedback dialog
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.menu.topbar.triggerTopbarCommand(['Help', 'Feedback'])

    // Test rating interaction
    const stars = comfyPage.page.locator('.pi-star')
    await stars.nth(3).click()
    await expect(
      comfyPage.page.getByLabel('Rating').locator('i').nth(3)
    ).toHaveClass(/pi-star-fill/)
  })
})
