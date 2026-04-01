import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from './BaseDialog'

export class SignInDialog extends BaseDialog {
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly signInButton: Locator
  readonly forgotPasswordLink: Locator
  readonly apiKeyButton: Locator
  readonly termsLink: Locator
  readonly privacyLink: Locator

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
  }

  async open() {
    await this.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showSignInDialog()
    })
    await this.waitForVisible()
  }

  get heading() {
    return this.root.getByRole('heading').first()
  }

  get signUpLink() {
    return this.root.getByText('Sign up', { exact: true })
  }

  get signInLink() {
    return this.root.getByText('Sign in', { exact: true })
  }

  get signUpEmailInput() {
    return this.root.locator('#comfy-org-sign-up-email')
  }

  get signUpPasswordInput() {
    return this.root.locator('#comfy-org-sign-up-password')
  }

  get signUpConfirmPasswordInput() {
    return this.root.locator('#comfy-org-sign-up-confirm-password')
  }

  get signUpButton() {
    return this.root.getByRole('button', { name: 'Sign up', exact: true })
  }

  get apiKeyHeading() {
    return this.root.getByRole('heading', { name: 'API Key' })
  }

  get apiKeyInput() {
    return this.root.locator('#comfy-org-api-key')
  }

  get backButton() {
    return this.root.getByRole('button', { name: 'Back' })
  }

  get dividerText() {
    return this.root.getByText('Or continue with')
  }
}
