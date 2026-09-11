import { expect } from '@playwright/test'

import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { localSignedOutFixture as test } from '@e2e/fixtures/localSignedOutFixture'

/**
 * The live password-requirements checklist on sign-up (`PasswordRules.vue`),
 * which marks each unmet rule red as the person types, before submit. This
 * is separate from `signInDialogAuth.spec.ts`'s mismatched-confirmation
 * case: that proves the submit button reacts, this proves the per-rule
 * feedback a person actually watches while typing a new password.
 */
test.describe('Sign In dialog — password requirements checklist', () => {
  test('marks unmet rules as the password is typed, and clears them once satisfied', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const dialog = new SignInDialog(page)
    await dialog.open()
    await dialog.signUpLink.click()

    const lengthRule = page.getByText('Must be between 8 and 32 characters')
    const uppercaseRule = page.getByText(
      'Must contain at least one uppercase letter'
    )
    const numberRule = page.getByText('Must contain at least one number')
    const specialRule = page.getByText(
      'Must contain at least one special character'
    )

    await dialog.signUpPasswordInput.fill('short')
    await expect(lengthRule).toHaveClass(/text-red-500/)
    await expect(uppercaseRule).toHaveClass(/text-red-500/)
    await expect(numberRule).toHaveClass(/text-red-500/)
    await expect(specialRule).toHaveClass(/text-red-500/)

    await dialog.signUpPasswordInput.fill('Sup3r-secret-pass!')
    await expect(lengthRule).not.toHaveClass(/text-red-500/)
    await expect(uppercaseRule).not.toHaveClass(/text-red-500/)
    await expect(numberRule).not.toHaveClass(/text-red-500/)
    await expect(specialRule).not.toHaveClass(/text-red-500/)
  })

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
