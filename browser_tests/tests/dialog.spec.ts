import { expect } from '@playwright/test'

import type { Keybinding } from '@/platform/keybindings/types'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Settings', () => {
  test('@mobile Should be visible on mobile', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.getByTestId('settings-dialog')
    await expect(settingsDialog).toBeVisible()
    const contentArea = settingsDialog.locator('main')
    await expect(contentArea).toBeVisible()
    await expect
      .poll(() => contentArea.evaluate((el) => el.clientHeight))
      .toBeGreaterThan(30)
  })

  test('Can open settings with hotkey', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.down('ControlOrMeta')
    await comfyPage.page.keyboard.press(',')
    await comfyPage.page.keyboard.up('ControlOrMeta')
    const settingsLocator = comfyPage.page.getByTestId('settings-dialog')
    await expect(settingsLocator).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(settingsLocator).toBeHidden()
  })

  test('Can change canvas zoom speed setting', async ({ comfyPage }) => {
    const maxSpeed = 2.5
    await comfyPage.settings.setSetting('Comfy.Graph.ZoomSpeed', maxSpeed)

    await test.step('Setting should persist', async () => {
      await expect
        .poll(() => comfyPage.settings.getSetting('Comfy.Graph.ZoomSpeed'))
        .toBe(maxSpeed)
    })
  })

  test('Should persist keybinding setting', async ({ comfyPage }) => {
    // Open the settings dialog
    await comfyPage.page.keyboard.press('Control+,')

    // Open the keybinding tab
    const settingsDialog = comfyPage.page.getByTestId('settings-dialog')
    await expect(settingsDialog).toBeVisible()
    await settingsDialog
      .locator('nav [role="button"]', { hasText: 'Keybinding' })
      .click()
    await expect(
      comfyPage.page.getByPlaceholder('Search Keybindings...')
    ).toBeVisible()

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

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeNum)
  })
  //FIXME: neither of these tests are useful both need rewrites
  test('Sign-in dialog resolves false when closed without sign-in', async ({
    comfyPage
  }) => {
    type AugmentedWindow = Window &
      typeof globalThis & { signInPromise?: Promise<boolean> }
    await comfyPage.page.evaluate(async () => {
      ;(window as AugmentedWindow).signInPromise =
        window.app!.extensionManager.dialog.showSignInDialog()
    })

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.waitForVisible()

    await dialog.close()
    await expect(dialog.root).not.toBeVisible()

    expect(
      await comfyPage.page.evaluate(
        () => (window as AugmentedWindow).signInPromise
      )
    ).toBe(false)
  })

  test('Sign-in dialog shows sign-in form and can fill credentials', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showSignInDialog()
    })

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.waitForVisible()

    await dialog.emailInput.fill('test@example.com')
    await expect(dialog.emailInput).toHaveValue('test@example.com')

    await dialog.passwordInput.fill('TestPassword123!')
    await expect(dialog.passwordInput).toHaveValue('TestPassword123!')

    await expect(dialog.signInButton).toBeEnabled()
  })
})

test.describe('API Nodes sign-in dialog', () => {
  test('Should display dialog with node names and resolve false on cancel', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void window
        .app!.extensionManager.dialog.showApiNodesSignInDialog([
          'FluxProGenerate',
          'StableDiffusion3Generate'
        ])
        .then((result: boolean) => {
          ;(window as unknown as Record<string, unknown>)['apiSignInResult'] =
            result
        })
    })

    const dialog = comfyPage.page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByText('Sign In Required to Use API Nodes')
    ).toBeVisible()
    await expect(dialog.getByText('FluxProGenerate')).toBeVisible()
    await expect(dialog.getByText('StableDiffusion3Generate')).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()

    expect(
      await comfyPage.page.evaluate(
        () => (window as unknown as Record<string, unknown>)['apiSignInResult']
      )
    ).toBe(false)
  })
})

test.describe('Update password dialog', () => {
  test('Should open update password dialog with form fields', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showUpdatePasswordDialog()
    })

    const dialog = comfyPage.page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await expect(dialog.locator('#comfy-org-sign-up-password')).toBeVisible()
    await expect(
      dialog.locator('#comfy-org-sign-up-confirm-password')
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Update Password' })
    ).toBeVisible()
  })
})

test.describe('Cloud notification dialog', () => {
  test('Should display cloud notification and navigate to comfy.org on Explore', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showCloudNotification()
    })

    const dialog = comfyPage.page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await expect(dialog.getByText('Run ComfyUI in the Cloud')).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Continue Locally' })
    ).toBeVisible()

    const popupPromise = comfyPage.page.waitForEvent('popup')
    await dialog.getByRole('button', { name: 'Try Cloud for Free' }).click()
    const popup = await popupPromise

    expect(new URL(popup.url()).hostname).toContain('comfy.org')
    await popup.close()
    await expect(dialog).not.toBeVisible()
  })

  test('Should close when Continue Locally is clicked', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showCloudNotification()
    })

    const dialog = comfyPage.page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Continue Locally' }).click()
    await expect(dialog).not.toBeVisible()
  })
})

test('Blueprint overwrite', { tag: ['@subgraph'] }, async ({ comfyPage }) => {
  const blueprintName = `test-blueprint-overwrite-${Date.now()}`
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.settings.setSetting(
    'Comfy.Workflow.WarnBlueprintOverwrite',
    true
  )

  const tab = comfyPage.menu.nodeLibraryTabV2
  await test.step('Publish a basic subgraph', async () => {
    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await comfyPage.contextMenu.openForVueNode(ksampler.header)
    await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
    await comfyPage.subgraph.publishSubgraph(blueprintName)

    await tab.open()
    await tab.getFolder('My Blueprints').click()
    await tab.getFolder('User').click()
  })

  const steps = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')
  await test.step('Edit the published subgraph', async () => {
    const blueprintNode = tab.getNode(blueprintName)
    await expect(blueprintNode, 'blueprint visible in library').toBeVisible()
    await blueprintNode.getByRole('button', { name: 'Edit' }).click()
    await steps.waitFor({ state: 'visible' })
  })

  const confirmDialog = comfyPage.confirmDialog.root
  const { incrementButton } = comfyPage.vueNodes.getInputNumberControls(steps)
  const dirtyGraphAndSave = async () => {
    await incrementButton.click()
    await comfyPage.page.keyboard.press('Control+s')
  }

  await test.step('No dialog: user prompted on publish', async () => {
    await dirtyGraphAndSave()
    await comfyPage.nextFrame()
    await expect(confirmDialog).not.toBeVisible()
  })

  await test.step('Should show dialog', async () => {
    await comfyPage.subgraph.setSaveUnpromptedOnActiveBlueprint()
    await dirtyGraphAndSave()
    const { noWarnOverwriteToggle } = comfyPage.confirmDialog
    await expect(noWarnOverwriteToggle).toBeVisible()

    await test.step('Disable overwrite warning', async () => {
      await noWarnOverwriteToggle.check()
      await expect(confirmDialog.getByText(/Re-enable in/i)).toBeVisible()
      await comfyPage.confirmDialog.click('overwrite')
    })
  })

  await test.step('No dialog: disabled by setting', async () => {
    await comfyPage.subgraph.setSaveUnpromptedOnActiveBlueprint()
    await dirtyGraphAndSave()
    await comfyPage.nextFrame()
    await expect(confirmDialog).not.toBeVisible()
  })
})
