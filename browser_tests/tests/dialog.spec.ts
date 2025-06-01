import { Locator, expect } from '@playwright/test'

import type { Keybinding } from '../../src/schemas/keyBindingSchema'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

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

  test('Should display a warning when missing models are found', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('missing_models')

    const missingModelsWarning = comfyPage.page.locator('.comfy-missing-models')
    await expect(missingModelsWarning).toBeVisible()

    const downloadButton = missingModelsWarning.getByLabel('Download')
    await expect(downloadButton).toBeVisible()
  })

  test('Should display a warning when missing models are found in node properties', async ({
    comfyPage
  }) => {
    // Load workflow that has a node with models metadata at the node level
    await comfyPage.loadWorkflow('missing_models_from_node_properties')

    const missingModelsWarning = comfyPage.page.locator('.comfy-missing-models')
    await expect(missingModelsWarning).toBeVisible()

    const downloadButton = missingModelsWarning.getByLabel('Download')
    await expect(downloadButton).toBeVisible()
  })

  test('Should not display a warning when no missing models are found', async ({
    comfyPage
  }) => {
    const modelFoldersRes = {
      status: 200,
      body: JSON.stringify([
        {
          name: 'text_encoders',
          folders: ['ComfyUI/models/text_encoders']
        }
      ])
    }
    await comfyPage.page.route(
      '**/api/experiment/models',
      (route) => route.fulfill(modelFoldersRes),
      { times: 1 }
    )

    // Reload page to trigger indexing of model folders
    await comfyPage.setup()

    const clipModelsRes = {
      status: 200,
      body: JSON.stringify([
        {
          name: 'fake_model.safetensors',
          pathIndex: 0
        }
      ])
    }
    await comfyPage.page.route(
      '**/api/experiment/models/text_encoders',
      (route) => route.fulfill(clipModelsRes),
      { times: 1 }
    )

    await comfyPage.loadWorkflow('missing_models')

    const missingModelsWarning = comfyPage.page.locator('.comfy-missing-models')
    await expect(missingModelsWarning).not.toBeVisible()
  })

  test('Should not display warning when model metadata exists but widget values have changed', async ({
    comfyPage
  }) => {
    // This tests the scenario where outdated model metadata exists in the workflow
    // but the actual selected models (widget values) have changed
    await comfyPage.loadWorkflow('model_metadata_widget_mismatch')

    // The missing models warning should NOT appear
    const missingModelsWarning = comfyPage.page.locator('.comfy-missing-models')
    await expect(missingModelsWarning).not.toBeVisible()
  })

  // Flaky test after parallelization
  // https://github.com/Comfy-Org/ComfyUI_frontend/pull/1400
  test.skip('Should download missing model when clicking download button', async ({
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

  test.describe('Do not show again checkbox', () => {
    let checkbox: Locator
    let closeButton: Locator

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting(
        'Comfy.Workflow.ShowMissingModelsWarning',
        true
      )
      await comfyPage.loadWorkflow('missing_models')

      checkbox = comfyPage.page.getByLabel("Don't show this again")
      closeButton = comfyPage.page.getByLabel('Close')
    })

    test('Should disable warning dialog when checkbox is checked', async ({
      comfyPage
    }) => {
      await checkbox.click()
      const changeSettingPromise = comfyPage.page.waitForRequest(
        '**/api/settings/Comfy.Workflow.ShowMissingModelsWarning'
      )
      await closeButton.click()
      await changeSettingPromise

      const settingValue = await comfyPage.getSetting(
        'Comfy.Workflow.ShowMissingModelsWarning'
      )
      expect(settingValue).toBe(false)
    })

    test('Should keep warning dialog enabled when checkbox is unchecked', async ({
      comfyPage
    }) => {
      await closeButton.click()

      const settingValue = await comfyPage.getSetting(
        'Comfy.Workflow.ShowMissingModelsWarning'
      )
      expect(settingValue).toBe(true)
    })
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
      .getByLabel('New Blank Workflow')
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
})

test.describe('Error dialog', () => {
  test('Should display an error dialog when graph configure fails', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      const graph = window['graph']
      graph.configure = () => {
        throw new Error('Error on configure!')
      }
    })

    await comfyPage.loadWorkflow('default')

    const errorDialog = comfyPage.page.locator('.comfy-error-report')
    await expect(errorDialog).toBeVisible()
  })

  test('Should display an error dialog when prompt execution fails', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(async () => {
      const app = window['app']
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
    const nodeNum = (await comfyPage.getNodes()).length
    await comfyPage.clickEmptyLatentNode()
    await comfyPage.ctrlC()

    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.fill('test_password')
    await textBox.press('Control+a')
    await textBox.press('Control+c')

    await comfyPage.page.evaluate(() => {
      window['app'].extensionManager.dialog.showSignInDialog()
    })

    const input = comfyPage.page.locator('#comfy-org-sign-in-password')
    await input.waitFor({ state: 'visible' })
    await input.press('Control+v')
    await expect(input).toHaveValue('test_password')

    expect(await comfyPage.getNodes()).toHaveLength(nodeNum)
  })
})
