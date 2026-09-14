import { expect } from '@playwright/test'

import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { localSignedOutFixture as test } from '@e2e/fixtures/localSignedOutFixture'

/**
 * Sign-up submission stays blocked while a password rule is unmet, end to end
 * through the dialog. Per-rule marking as the person types lives in
 * `@comfyorg/account`'s `PasswordRules.test.ts` unit test; asserting the red
 * marking here would couple the spec to the host's `unmet-class`.
 */
test.describe('Sign In dialog — password requirements checklist', () => {
  test('keeps the submit button disabled while a password rule is unmet', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const dialog = new SignInDialog(page)
    await dialog.open()
    await dialog.signUpLink.click()

    await dialog.signUpEmailInput.fill('weak-password@test.comfy.org')
    await dialog.signUpPasswordInput.fill('alllowercase1!')
    await dialog.signUpConfirmPasswordInput.fill('alllowercase1!')

    await expect(
      dialog.signUpButton,
      'a password missing an uppercase letter must not be submittable'
    ).toBeDisabled()
  })
})
