import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class SignInDialog extends BaseDialog {
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly signInButton: Locator
  readonly forgotPasswordLink: Locator
  readonly apiKeyButton: Locator
  readonly termsLink: Locator
  readonly privacyLink: Locator
  readonly heading: Locator
  readonly signUpLink: Locator
  readonly signInLink: Locator
  readonly signUpEmailInput: Locator
  readonly signUpPasswordInput: Locator
  readonly signUpConfirmPasswordInput: Locator
  readonly signUpButton: Locator
  readonly apiKeyHeading: Locator
  readonly apiKeyInput: Locator
  readonly backButton: Locator
  readonly dividerText: Locator

  constructor(page: Page) {
    super(page)
    this.emailInput = this.root.locator('#comfy-org-sign-in-email')
    this.passwordInput = this.root.locator('#comfy-org-sign-in-password')
    this.signInButton = this.root.getByRole('button', { name: 'Sign in' })
    this.forgotPasswordLink = this.root.getByText('Forgot password?')
    this.apiKeyButton = this.root.getByRole('button', {
      name: 'Comfy API Key'
    })
    this.termsLink = this.root.getByRole('link', { name: 'Terms of Use' })
    this.privacyLink = this.root.getByRole('link', { name: 'Privacy Policy' })
    this.heading = this.root.getByRole('heading').first()
    this.signUpLink = this.root.getByText('Sign up', { exact: true })
    this.signInLink = this.root.getByText('Sign in', { exact: true })
    this.signUpEmailInput = this.root.locator('#comfy-org-sign-up-email')
    this.signUpPasswordInput = this.root.locator('#comfy-org-sign-up-password')
    this.signUpConfirmPasswordInput = this.root.locator(
      '#comfy-org-sign-up-confirm-password'
    )
    this.signUpButton = this.root.getByRole('button', {
      name: 'Sign up',
      exact: true
    })
    this.apiKeyHeading = this.root.getByRole('heading', { name: 'API Key' })
    this.apiKeyInput = this.root.locator('#comfy-org-api-key')
    this.backButton = this.root.getByRole('button', { name: 'Back' })
    this.dividerText = this.root.getByText('Or continue with')
  }

  async open() {
    await this.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showSignInDialog()
    })
    await this.waitForVisible()
  }

  async openWithResult(): Promise<{ result: Promise<boolean> }> {
    const result = this.page.evaluate(() =>
      window.app!.extensionManager.dialog.showSignInDialog()
    )
    await this.waitForVisible()
    return { result }
  }
}
