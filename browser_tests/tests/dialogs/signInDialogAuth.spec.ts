import { expect } from '@playwright/test'

import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { localSignedOutFixture as test } from '@e2e/fixtures/localSignedOutFixture'

/**
 * Live sign-in/sign-up/forgot-password through the local dialog
 * (`showSignInDialog()`), driven for real against a mocked Firebase REST
 * backend. `signInDialog.spec.ts` covers the dialog's structure without
 * authenticating; this file proves the actual credential round trip: submit
 * → Firebase call → the app observes the resulting signed-in state.
 *
 * Boots signed out via `localSignedOutFixture`, not the `@auth`-tagged
 * `comfyPageFixture`: that fixture's own boot sequence fires
 * `/api/workspaces` before a spec's `beforeEach` can register a mock for it.
 */
test.describe('Sign In dialog — live auth', () => {
  test('signs in with email and password', async ({ comfyPage }) => {
    await comfyPage.cloudAuth.mockLiveEmailSignIn()

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.emailInput.fill(CLOUD_SELF_EMAIL)
    await dialog.passwordInput.fill('correct-horse-battery-staple')
    await dialog.signInButton.click()

    await expect(dialog.root).toBeHidden()
    await expect(
      comfyPage.page.getByRole('button', { name: 'Current user' })
    ).toBeVisible()
  })

  test('shows an inline error and stays open on a wrong password', async ({
    comfyPage
  }) => {
    await comfyPage.cloudAuth.mockLiveEmailSignInFailure({
      code: 400,
      message: 'INVALID_LOGIN_CREDENTIALS'
    })

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.emailInput.fill(CLOUD_SELF_EMAIL)
    await dialog.passwordInput.fill('wrong-password')
    await dialog.passwordInput.blur()
    await dialog.signInButton.click()

    await expect(dialog.root).toBeVisible()
    await expect(
      comfyPage.page.getByText('Invalid login credentials')
    ).toBeVisible()
  })

  test('creates an account with email, password, and confirmation', async ({
    comfyPage
  }) => {
    const newEmail = 'new-user@test.comfy.org'
    await comfyPage.cloudAuth.mockLiveEmailSignUp(newEmail)

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()
    await dialog.signUpLink.click()
    await expect(
      dialog.root.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()

    await dialog.signUpEmailInput.fill(newEmail)
    await dialog.signUpPasswordInput.fill('Sup3r-secret-pass!')
    await dialog.signUpConfirmPasswordInput.fill('Sup3r-secret-pass!')
    await dialog.signUpButton.click()

    await expect(dialog.root).toBeHidden()
    await expect(
      comfyPage.page.getByRole('button', { name: 'Current user' })
    ).toBeVisible()
  })

  test('does not sign up when the passwords do not match', async ({
    comfyPage
  }) => {
    await comfyPage.cloudAuth.mockLiveEmailSignUp()

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()
    await dialog.signUpLink.click()

    await dialog.signUpEmailInput.fill('mismatch@test.comfy.org')
    await dialog.signUpPasswordInput.fill('Sup3r-secret-pass!')
    await dialog.signUpConfirmPasswordInput.fill('DifferentPassword1!')
    await dialog.signUpConfirmPasswordInput.blur()

    await expect(
      dialog.signUpButton,
      'a mismatched confirmation must keep the submit button disabled, never allow the request to fire'
    ).toBeDisabled()
  })

  test('keeps the just-created Firebase user out of a signed-in state when provisioning fails', async ({
    comfyPage
  }) => {
    const email = 'orphan-rollback@test.comfy.org'
    await comfyPage.cloudAuth.mockLiveEmailSignUp(email)
    await comfyPage.cloudAuth.mockLiveEmailSignUpProvisioningFailure(500)
    await comfyPage.page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route) => {
        if (route.request().url().includes('accounts:delete')) {
          await route.fulfill({ status: 200, json: {} })
          return
        }
        await route.fallback()
      }
    )

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()
    await dialog.signUpLink.click()

    await dialog.signUpEmailInput.fill(email)
    await dialog.signUpPasswordInput.fill('Sup3r-secret-pass!')
    await dialog.signUpConfirmPasswordInput.fill('Sup3r-secret-pass!')
    const provisioningFailed = comfyPage.page.waitForResponse(
      (response) =>
        response.url().includes('/customers') &&
        response.request().method() === 'POST'
    )
    const rollbackDelete = comfyPage.page.waitForResponse((response) =>
      response.url().includes('accounts:delete')
    )
    await dialog.signUpButton.click()
    await provisioningFailed
    await rollbackDelete

    await expect(
      dialog.root,
      'the dialog stays open on a failed signup, never advancing to a signed-in app'
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('button', { name: 'Current user' }),
      'a failed customer-provisioning step must not leave the app signed in'
    ).toBeHidden()
  })

  test('sends a password reset email and shows the confirmation toast', async ({
    comfyPage
  }) => {
    await comfyPage.cloudAuth.mockLivePasswordReset()

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.emailInput.fill(CLOUD_SELF_EMAIL)
    await dialog.forgotPasswordLink.click()

    await expect(
      comfyPage.page.getByText('Password reset email sent')
    ).toBeVisible()
  })

  test('warns instead of sending when the email field is empty', async ({
    comfyPage
  }) => {
    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.forgotPasswordLink.click()

    await expect(comfyPage.page.getByText('Enter your email')).toBeVisible()
    await expect(dialog.emailInput).toBeFocused()
  })

  test('reports a real transport failure on password reset without claiming success', async ({
    comfyPage
  }) => {
    await comfyPage.cloudAuth.mockLivePasswordResetTransportFailure()

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.emailInput.fill(CLOUD_SELF_EMAIL)
    const resetFailed = comfyPage.page.waitForEvent('requestfailed', {
      predicate: (request) => request.url().includes('accounts:sendOobCode')
    })
    await dialog.forgotPasswordLink.click()
    await resetFailed

    await expect(
      comfyPage.page.getByText(
        'Network error. Please check your connection and try again.'
      ),
      'a dropped connection must surface the network error, not a silent failure'
    ).toBeVisible()
    await expect(
      comfyPage.page.getByText('Password reset email sent'),
      'a real transport failure must not show the success confirmation'
    ).toBeHidden()
  })
})
