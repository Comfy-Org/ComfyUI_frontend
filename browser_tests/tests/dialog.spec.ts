import { expect } from '@playwright/test'

import type { Keybinding } from '@/platform/keybindings/types'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
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
