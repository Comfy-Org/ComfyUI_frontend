import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import { TestIds } from '@e2e/fixtures/selectors'

export class PublishDialog extends BaseDialog {
  readonly nav: Locator
  readonly footer: Locator
  readonly savePrompt: Locator
  readonly describeStep: Locator
  readonly finishStep: Locator
  readonly profilePrompt: Locator
  readonly gateFlow: Locator
  readonly nameInput: Locator
  readonly descriptionTextarea: Locator
  readonly tagsInput: Locator
  readonly backButton: Locator
  readonly nextButton: Locator
  readonly publishButton: Locator

  constructor(page: Page) {
    super(page, TestIds.publish.dialog)
    this.nav = this.root.getByTestId(TestIds.publish.nav)
    this.footer = this.root.getByTestId(TestIds.publish.footer)
    this.savePrompt = this.root.getByTestId(TestIds.publish.savePrompt)
    this.describeStep = this.root.getByTestId(TestIds.publish.describeStep)
    this.finishStep = this.root.getByTestId(TestIds.publish.finishStep)
    this.profilePrompt = this.root.getByTestId(TestIds.publish.profilePrompt)
    this.gateFlow = this.root.getByTestId(TestIds.publish.gateFlow)
    this.nameInput = this.root.getByTestId(TestIds.publish.nameInput)
    this.descriptionTextarea = this.describeStep.locator('textarea')
    this.tagsInput = this.root.getByTestId(TestIds.publish.tagsInput)
    this.backButton = this.footer.getByRole('button', { name: 'Back' })
    this.nextButton = this.footer.getByRole('button', { name: 'Next' })
    this.publishButton = this.footer.getByRole('button', {
      name: 'Publish to ComfyHub'
    })
  }

  // Uses showPublishDialog() via Vite-bundled lazy imports that work in both
  // dev and production, rather than clicking through the UI.
  async open(): Promise<void> {
    await this.page.evaluate(async () => {
      await window.app!.extensionManager.dialog.showPublishDialog()
    })
    await this.waitForVisible()
  }

  tagSuggestion(name: string): Locator {
    return this.describeStep.getByText(name, { exact: true })
  }

  navStep(label: string): Locator {
    return this.nav.getByRole('button', { name: label })
  }

  currentNavStep(): Locator {
    return this.nav.locator('[aria-current="step"]')
  }

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
