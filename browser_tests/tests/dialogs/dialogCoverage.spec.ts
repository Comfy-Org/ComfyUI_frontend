import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { SignInDialog } from '../../fixtures/components/SignInDialog'

type DialogStore = {
  dialog: {
    showApiNodesSignInDialog: (names: string[]) => Promise<boolean>
    showUpdatePasswordDialog: () => void
    showCloudNotification: () => Promise<void>
    showErrorDialog: (
      error: unknown,
      options?: { title?: string; reportType?: string }
    ) => void
    showExecutionErrorDialog: (error: {
      exception_type: string
      exception_message: string
      node_id: string | number
      node_type: string
      traceback: string[]
    }) => void
    confirm: (options: {
      title: string
      message: string
      type: string
      itemList: string[]
    }) => Promise<boolean | null>
  }
}

test.describe('API Nodes sign-in dialog', { tag: '@ui' }, () => {
  test('Should display dialog with node names and resolve false on cancel', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void (window.app!.extensionManager as DialogStore).dialog
        .showApiNodesSignInDialog([
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

test.describe('Update password dialog', { tag: '@ui' }, () => {
  test('Should open update password dialog with form fields', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void (
        window.app!.extensionManager as DialogStore
      ).dialog.showUpdatePasswordDialog()
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

test.describe('Cloud notification dialog', { tag: '@ui' }, () => {
  test('Should display cloud notification and navigate to comfy.org on Explore', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void (
        window.app!.extensionManager as DialogStore
      ).dialog.showCloudNotification()
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
      void (
        window.app!.extensionManager as DialogStore
      ).dialog.showCloudNotification()
    })

    const dialog = comfyPage.page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Continue Locally' }).click()
    await expect(dialog).not.toBeVisible()
  })
})

test.describe('parseError with extension filename', { tag: '@ui' }, () => {
  test('Should display extension file hint when error originates from extension', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      const error = new Error('Extension error!')
      ;(error as Error & { fileName: string }).fileName =
        '/extensions/my-custom-extension/main.js'

      ;(window.app!.extensionManager as DialogStore).dialog.showErrorDialog(
        error
      )
    })

    const errorDialog = comfyPage.page.locator('.comfy-error-report')
    await expect(errorDialog).toBeVisible()

    await expect(
      errorDialog.getByText('/extensions/my-custom-extension/main.js')
    ).toBeVisible()
    await expect(
      errorDialog.getByText('This may be due to the following script')
    ).toBeVisible()
  })
})

test.describe('showErrorDialog with string error', { tag: '@ui' }, () => {
  test('Should display a string error message', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      ;(window.app!.extensionManager as DialogStore).dialog.showErrorDialog(
        'Something went wrong',
        {
          title: 'Custom Error Title'
        }
      )
    })

    const errorDialog = comfyPage.page.locator('.comfy-error-report')
    await expect(errorDialog).toBeVisible()

    await expect(errorDialog.getByText('Custom Error Title')).toBeVisible()
    await expect(errorDialog.getByText('Something went wrong')).toBeVisible()
  })

  test('Should display default title when no title provided', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      ;(window.app!.extensionManager as DialogStore).dialog.showErrorDialog(
        'A simple string error'
      )
    })

    const errorDialog = comfyPage.page.locator('.comfy-error-report')
    await expect(errorDialog).toBeVisible()

    await expect(errorDialog.getByText('Unknown Error')).toBeVisible()
    await expect(errorDialog.getByText('A simple string error')).toBeVisible()
  })
})

test.describe('Successful sign-in dialog completion', { tag: '@ui' }, () => {
  test('Sign-in dialog resolves false when closed without sign-in', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      void window
        .app!.extensionManager.dialog.showSignInDialog()
        .then((result: boolean) => {
          ;(window as unknown as Record<string, unknown>)['signInResult'] =
            result
        })
    })

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.waitForVisible()

    await dialog.close()
    await expect(dialog.root).not.toBeVisible()

    expect(
      await comfyPage.page.evaluate(
        () => (window as unknown as Record<string, unknown>)['signInResult']
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

test(
  'Blueprint overwrite',
  { tag: ['@ui', '@subgraph'] },
  async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    const blueprintName = `test-blueprint-overwrite-${Date.now()}`
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WarnBlueprintOverwrite',
      true
    )

    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await comfyPage.contextMenu.openForVueNode(ksampler.header)
    await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
    await comfyPage.subgraph.publishSubgraph(blueprintName)

    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
    await tab.getFolder('My Blueprints').click()
    await tab.getFolder('User').click()

    const blueprintNode = tab.getNode(blueprintName)
    await expect(blueprintNode, 'blueprint visible in library').toBeVisible()
    await blueprintNode.getByRole('button', { name: 'Edit' }).click()
    const steps = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')
    await steps.waitFor({ state: 'visible' })

    const dialog = comfyPage.page.getByRole('dialog')
    const { incrementButton } = comfyPage.vueNodes.getInputNumberControls(steps)
    const dirtyGraphAndSave = async () => {
      await incrementButton.click()
      await comfyPage.page.keyboard.press('Control+s')
    }

    await dirtyGraphAndSave()
    await comfyPage.nextFrame()
    await expect(dialog, 'was already prompted on publish').not.toBeVisible()

    await comfyPage.subgraph.setSaveUnpromptedOnActiveBlueprint()
    await dirtyGraphAndSave()
    await expect(
      dialog.getByText('Overwrite existing blueprint?')
    ).toBeVisible()
    await expect(dialog.locator('#doNotAskAgain')).toBeVisible()

    await dialog.locator('#doNotAskAgain').check()
    await expect(dialog.getByText(/Re-enable in/i)).toBeVisible()
    await dialog.getByRole('button', { name: 'Overwrite' }).click()
    await dialog.waitFor({ state: 'hidden' })

    await comfyPage.subgraph.setSaveUnpromptedOnActiveBlueprint()
    await dirtyGraphAndSave()
    await comfyPage.nextFrame()
    await expect(dialog).not.toBeVisible()
  }
)

test.describe(
  'Execution error dialog without node type',
  { tag: '@ui' },
  () => {
    test('Should display execution error dialog when node_type is empty', async ({
      comfyPage
    }) => {
      await comfyPage.page.evaluate(() => {
        ;(
          window.app!.extensionManager as DialogStore
        ).dialog.showExecutionErrorDialog({
          exception_type: 'RuntimeError',
          exception_message: 'CUDA out of memory',
          node_id: '42',
          node_type: '',
          traceback: ['Traceback (most recent call last):', '  File ...']
        })
      })

      const errorDialog = comfyPage.page.locator('.comfy-error-report')
      await expect(errorDialog).toBeVisible()

      // When node_type is empty, the title falls back to exceptionType
      await expect(errorDialog.getByText('RuntimeError')).toBeVisible()
      await expect(errorDialog.getByText('CUDA out of memory')).toBeVisible()
    })
  }
)
