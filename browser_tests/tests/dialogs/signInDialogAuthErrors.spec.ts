import { expect } from '@playwright/test'

import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { localSignedOutFixture as test } from '@e2e/fixtures/localSignedOutFixture'

/**
 * Firebase error codes beyond the generic `invalid-credential` case
 * `signInDialogAuth.spec.ts` already covers: a nonexistent account, a
 * disabled one, rate limiting, a duplicate email on sign-up, and a dropped
 * connection. Each is a distinct REST response the app's copy map treats
 * differently, per `firebaseAuthError.ts`.
 */
test.describe('Sign In dialog — auth error codes', () => {
  test('shows the same neutral copy for a nonexistent account as a wrong password', async ({
    comfyPage
  }) => {
    await comfyPage.cloudAuth.mockLiveEmailSignInFailure({
      code: 400,
      message: 'EMAIL_NOT_FOUND'
    })

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.emailInput.fill('nobody@test.comfy.org')
    await dialog.passwordInput.fill('whatever-password')
    await dialog.passwordInput.blur()
    await dialog.signInButton.click()

    await expect(dialog.root).toBeVisible()
    await expect(
      comfyPage.page.getByText('Invalid login credentials'),
      'the same copy as a wrong password keeps sign-in from revealing whether an email has an account'
    ).toBeVisible()
  })

  test('reports a disabled account', async ({ comfyPage }) => {
    await comfyPage.cloudAuth.mockLiveEmailSignInFailure({
      code: 400,
      message: 'USER_DISABLED'
    })

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.emailInput.fill(CLOUD_SELF_EMAIL)
    await dialog.passwordInput.fill('correct-horse-battery-staple')
    await dialog.passwordInput.blur()
    await dialog.signInButton.click()

    await expect(
      comfyPage.page.getByText(
        'This account has been disabled. Please contact support.'
      )
    ).toBeVisible()
  })

  test('reports rate limiting after repeated failed attempts', async ({
    comfyPage
  }) => {
    await comfyPage.cloudAuth.mockLiveEmailSignInFailure({
      code: 400,
      message: 'TOO_MANY_ATTEMPTS_TRY_LATER'
    })

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.emailInput.fill(CLOUD_SELF_EMAIL)
    await dialog.passwordInput.fill('wrong-password')
    await dialog.passwordInput.blur()
    await dialog.signInButton.click()

    await expect(
      comfyPage.page.getByText(
        'Too many login attempts. Please wait a moment and try again.'
      )
    ).toBeVisible()
  })

  test('reports a duplicate email on sign-up instead of creating a second account', async ({
    comfyPage
  }) => {
    await comfyPage.cloudAuth.mockLiveEmailSignUpFailure({
      code: 400,
      message: 'EMAIL_EXISTS'
    })

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()
    await dialog.signUpLink.click()

    await dialog.signUpEmailInput.fill(CLOUD_SELF_EMAIL)
    await dialog.signUpPasswordInput.fill('Sup3r-secret-pass!')
    await dialog.signUpConfirmPasswordInput.fill('Sup3r-secret-pass!')
    await dialog.signUpButton.click()

    await expect(
      comfyPage.page.getByText(
        'An account with this email already exists. Try signing in instead.'
      )
    ).toBeVisible()
    await expect(dialog.root).toBeVisible()
  })

  test('reports a dropped connection without claiming invalid credentials', async ({
    comfyPage
  }) => {
    await comfyPage.cloudAuth.mockLiveEmailSignInTransportFailure()

    const dialog = new SignInDialog(comfyPage.page)
    await dialog.open()

    await dialog.emailInput.fill(CLOUD_SELF_EMAIL)
    await dialog.passwordInput.fill('correct-horse-battery-staple')
    await dialog.passwordInput.blur()
    await dialog.signInButton.click()

    await expect(
      comfyPage.page.getByText(
        'Network error. Please check your connection and try again.'
      )
    ).toBeVisible()
    await expect(
      comfyPage.page.getByText('Invalid login credentials'),
      'a dropped connection must not be misreported as bad credentials'
    ).toBeHidden()
  })
})
