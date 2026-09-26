import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

test.describe('Sign In dialog', { tag: '@ui' }, () => {
  let dialog: SignInDialog

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new SignInDialog(comfyPage.page)
    await dialog.open()
  })

  test('Should open and show the sign-in form by default', async () => {
    await expect(
      dialog.root.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()
    await expect(dialog.emailInput).toBeVisible()
    await expect(dialog.passwordInput).toBeVisible()
    await expect(dialog.signInButton).toBeVisible()
  })

  test('Should toggle from sign-in to sign-up form', async () => {
    await dialog.signUpLink.click()

    await expect(
      dialog.root.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()
    await expect(dialog.signUpEmailInput).toBeVisible()
    await expect(dialog.signUpPasswordInput).toBeVisible()
    await expect(dialog.signUpConfirmPasswordInput).toBeVisible()
    await expect(dialog.signUpButton).toBeVisible()
  })

  test('Should toggle back from sign-up to sign-in form', async () => {
    await dialog.signUpLink.click()
    await expect(
      dialog.root.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()

    await dialog.signInLink.click()
    await expect(
      dialog.root.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()
    await expect(dialog.emailInput).toBeVisible()
    await expect(dialog.passwordInput).toBeVisible()
  })

  test('Should navigate to the API Key form and back', async () => {
    await dialog.apiKeyButton.click()

    await expect(dialog.apiKeyHeading).toBeVisible()
    await expect(dialog.apiKeyInput).toBeVisible()

    await dialog.backButton.click()
    await expect(
      dialog.root.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()
  })

  test('Should display Terms of Service and Privacy Policy links', async () => {
    await expect(dialog.termsLink).toBeVisible()
    await expect(dialog.termsLink).toHaveAttribute(
      'href',
      'https://comfy.org/terms-of-service/'
    )

    await expect(dialog.privacyLink).toBeVisible()
    await expect(dialog.privacyLink).toHaveAttribute(
      'href',
      'https://comfy.org/privacy-policy/'
    )
  })

  test('Should display the "Or continue with" divider and API key button', async () => {
    await expect(dialog.dividerText).toBeVisible()
    await expect(dialog.apiKeyButton).toBeVisible()
  })

  test('Should show forgot password link on sign-in form', async () => {
    await expect(dialog.forgotPasswordLink).toBeVisible()
  })

  test('Should close dialog via close button', async () => {
    await dialog.closeButton.click()
    await expect(dialog.root).toBeHidden()
  })

  test('Should close dialog via Escape key', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Escape')
    await expect(dialog.root).toBeHidden()
  })
})

test.describe('Sign In dialog - resolution', { tag: '@ui' }, () => {
  test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

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

  test('Sign-in dialog resolves true on login', async ({ comfyPage }) => {
    await comfyPage.cloudAuth.mockFirebaseEndpoints('test@example.com')
    await mockWorkspace(comfyPage.page, workspace('personal', 'owner'), [])
    await mockBilling(comfyPage.page)
    await comfyPage.page.route(
      '**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?*',
      (route) =>
        route.fulfill({
          json: {
            kind: 'identitytoolkit#VerifyPasswordResponse',
            localId: 'test-user-e2e',
            email: 'test@example.com',
            displayName: 'E2E Test User',
            idToken: 'mock-firebase-id-token',
            registered: true,
            refreshToken: 'mock-refresh-token',
            expiresIn: '3600'
          }
        })
    )
    await comfyPage.page.route('**/customers', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'test-user-e2e', email: 'test@example.com' })
      })
    )
    const dialog = new SignInDialog(comfyPage.page)
    const { result: dialogResult } = await dialog.openWithResult()

    await dialog.emailInput.fill('test@example.com')
    await dialog.passwordInput.fill('TestPassword123!')
    await expect(dialog.root).toBeVisible()

    const billingResponses = Promise.all(
      ['status', 'balance', 'plans'].map((endpoint) =>
        comfyPage.page.waitForResponse(`**/api/billing/${endpoint}`)
      )
    )
    await dialog.signInButton.click()
    await expect(dialog.root).toBeHidden()
    expect(await dialogResult).toBe(true)
    for (const response of await billingResponses) {
      expect(response.ok()).toBe(true)
    }
  })

  test('Sign-in dialog resolves false when closed without sign-in', async ({
    comfyPage
  }) => {
    const dialog = new SignInDialog(comfyPage.page)
    const { result: dialogResult } = await dialog.openWithResult()

    await dialog.close()
    await expect(dialog.root).toBeHidden()
    expect(await dialogResult).toBe(false)
  })
})
