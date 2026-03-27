import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

/**
 * Opens the Sign In dialog via the extensionManager API.
 * Returns a locator scoped to the dialog root.
 */
async function openSignInDialog(page: Page) {
  await page.evaluate(() => {
    void window.app!.extensionManager.dialog.showSignInDialog()
  })
  const dialog = page.locator('.p-dialog')
  await dialog.waitFor({ state: 'visible' })
  return dialog
}

test.describe('Sign In dialog', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('Should open the sign in dialog and show the sign-in form by default', async ({
    comfyPage
  }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    // Default view is Sign In
    await expect(
      dialog.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()

    // Email and password fields are present
    await expect(dialog.locator('#comfy-org-sign-in-email')).toBeVisible()
    await expect(dialog.locator('#comfy-org-sign-in-password')).toBeVisible()

    // Sign in submit button is present
    await expect(
      dialog.getByRole('button', { name: 'Sign in' })
    ).toBeVisible()
  })

  test('Should toggle from sign-in to sign-up form', async ({ comfyPage }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    // Click "Sign up" link to switch to sign-up form
    await dialog.getByText('Sign up', { exact: true }).click()

    // Heading changes to sign-up
    await expect(
      dialog.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()

    // Sign-up specific fields are present
    await expect(dialog.locator('#comfy-org-sign-up-email')).toBeVisible()
    await expect(dialog.locator('#comfy-org-sign-up-password')).toBeVisible()
    await expect(
      dialog.locator('#comfy-org-sign-up-confirm-password')
    ).toBeVisible()

    // Submit button says "Sign up"
    await expect(
      dialog.getByRole('button', { name: 'Sign up', exact: true })
    ).toBeVisible()
  })

  test('Should toggle back from sign-up to sign-in form', async ({
    comfyPage
  }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    // Go to sign-up
    await dialog.getByText('Sign up', { exact: true }).click()
    await expect(
      dialog.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()

    // Go back to sign-in
    await dialog.getByText('Sign in', { exact: true }).click()
    await expect(
      dialog.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()

    // Sign-in fields are restored
    await expect(dialog.locator('#comfy-org-sign-in-email')).toBeVisible()
    await expect(dialog.locator('#comfy-org-sign-in-password')).toBeVisible()
  })

  test('Should navigate to the API Key form and back', async ({
    comfyPage
  }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    // Click "Comfy API Key" button to open API Key form
    await dialog.getByRole('button', { name: 'Comfy API Key' }).click()

    // API Key form heading and input are visible
    await expect(
      dialog.getByRole('heading', { name: 'API Key' })
    ).toBeVisible()
    await expect(dialog.locator('#comfy-org-api-key')).toBeVisible()

    // Back button returns to the main sign-in view
    await dialog.getByRole('button', { name: 'Back' }).click()
    await expect(
      dialog.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()
  })

  test('Should display Terms of Service and Privacy Policy links', async ({
    comfyPage
  }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    const termsLink = dialog.getByRole('link', { name: 'Terms of Use' })
    await expect(termsLink).toBeVisible()
    await expect(termsLink).toHaveAttribute(
      'href',
      'https://www.comfy.org/terms-of-service'
    )

    const privacyLink = dialog.getByRole('link', { name: 'Privacy Policy' })
    await expect(privacyLink).toBeVisible()
    await expect(privacyLink).toHaveAttribute(
      'href',
      'https://www.comfy.org/privacy'
    )
  })

  test('Should display the "Or continue with" divider and API key button', async ({
    comfyPage
  }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    // Divider text
    await expect(dialog.getByText('Or continue with')).toBeVisible()

    // API key button is visible (non-cloud environment)
    await expect(
      dialog.getByRole('button', { name: 'Comfy API Key' })
    ).toBeVisible()
  })

  test('Should show forgot password link on sign-in form', async ({
    comfyPage
  }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    await expect(dialog.getByText('Forgot password?')).toBeVisible()
  })

  test('Should close dialog via close button', async ({ comfyPage }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    // Click the close button
    await dialog.getByRole('button', { name: 'Close' }).click({ force: true })
    await expect(dialog).toBeHidden()
  })

  test('Should close dialog via Escape key', async ({ comfyPage }) => {
    const dialog = await openSignInDialog(comfyPage.page)

    await comfyPage.page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})
