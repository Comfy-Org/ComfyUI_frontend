import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

import { BaseDialog } from './BaseDialog'

export class PublishDialog extends BaseDialog {
  readonly nav: Locator
  readonly footer: Locator
  readonly savePrompt: Locator

  constructor(page: Page) {
    super(page, TestIds.publish.dialog)
    this.nav = this.root.getByTestId(TestIds.publish.nav)
    this.footer = this.root.getByTestId(TestIds.publish.footer)
    this.savePrompt = this.root.getByTestId(TestIds.publish.savePrompt)
  }

  /**
   * Opens the publish dialog via the dialog service's showPublishDialog(),
   * which uses Vite-bundled lazy imports that work in both dev and production.
   */
  async open(): Promise<void> {
    await this.page.evaluate(async () => {
      await window.app!.extensionManager.dialog.showPublishDialog()
    })
    await this.waitForVisible()
  }

  // Step content locators

  get describeStep(): Locator {
    return this.root.getByTestId(TestIds.publish.describeStep)
  }

  get finishStep(): Locator {
    return this.root.getByTestId(TestIds.publish.finishStep)
  }

  get profilePrompt(): Locator {
    return this.root.getByTestId(TestIds.publish.profilePrompt)
  }

  get gateFlow(): Locator {
    return this.root.getByTestId(TestIds.publish.gateFlow)
  }

  // Describe step locators

  get nameInput(): Locator {
    return this.describeStep.getByRole('textbox').first()
  }

  get descriptionTextarea(): Locator {
    return this.describeStep.locator('textarea')
  }

  get tagsInput(): Locator {
    return this.describeStep.locator('[role="list"]').first()
  }

  tagSuggestion(name: string): Locator {
    return this.describeStep.getByText(name, { exact: true })
  }

  // Footer button locators

  get backButton(): Locator {
    return this.footer.getByRole('button', { name: 'Back' })
  }

  get nextButton(): Locator {
    return this.footer.getByRole('button', { name: 'Next' })
  }

  get publishButton(): Locator {
    return this.footer.getByRole('button', { name: 'Publish to ComfyHub' })
  }

  // Nav locators

  navStep(label: string): Locator {
    return this.nav.getByRole('button', { name: label })
  }

  currentNavStep(): Locator {
    return this.nav.locator('[aria-current="step"]')
  }

  // Navigation helpers

  async goNext(): Promise<void> {
    await this.nextButton.click()
  }

  async goBack(): Promise<void> {
    await this.backButton.click()
  }

  async goToStep(label: string): Promise<void> {
    await this.navStep(label).click()
  }
}
