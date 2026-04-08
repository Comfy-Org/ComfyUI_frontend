import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'

test.describe('Sign In dialog', { tag: '@ui' }, () => {
  let dialog: SignInDialog

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
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
    await expect(dialog.signUpLink).toBeVisible()
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
    await expect(dialog.signUpLink).toBeVisible()
    await dialog.signUpLink.click()
    await expect(
      dialog.root.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()

    await expect(dialog.signInLink).toBeVisible()
    await dialog.signInLink.click()
    await expect(
      dialog.root.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()
    await expect(dialog.emailInput).toBeVisible()
    await expect(dialog.passwordInput).toBeVisible()
  })

  test('Should navigate to the API Key form and back', async () => {
    await expect(dialog.apiKeyButton).toBeVisible()
    await dialog.apiKeyButton.click()

    await expect(dialog.apiKeyHeading).toBeVisible()
    await expect(dialog.apiKeyInput).toBeVisible()

    await expect(dialog.backButton).toBeVisible()
    await dialog.backButton.click()
    await expect(
      dialog.root.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()
  })

  test('Should display Terms of Service and Privacy Policy links', async () => {
    await expect(dialog.termsLink).toBeVisible()
    await expect(dialog.termsLink).toHaveAttribute(
      'href',
      'https://www.comfy.org/terms-of-service'
    )

    await expect(dialog.privacyLink).toBeVisible()
    await expect(dialog.privacyLink).toHaveAttribute(
      'href',
      'https://www.comfy.org/privacy'
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
    await expect(dialog.closeButton).toBeVisible()
    await dialog.closeButton.click()
    await expect(dialog.root).toBeHidden()
  })

  test('Should close dialog via Escape key', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Escape')
    await expect(dialog.root).toBeHidden()
  })
})
