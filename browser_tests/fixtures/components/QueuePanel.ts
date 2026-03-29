import type { Locator, Page } from '@playwright/test'

import { comfyExpect as expect } from '../ComfyPage'
import { TestIds } from '../selectors'

/**
 * Page object for the "Clear queue history?" confirmation dialog that opens
 * from the queue panel's history actions menu.
 */
export class QueueClearHistoryDialog {
  readonly root: Locator
  readonly cancelButton: Locator
  readonly clearButton: Locator
  readonly closeButton: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel' })
    this.clearButton = this.root.getByRole('button', { name: 'Clear' })
    this.closeButton = this.root.getByLabel('Close')
  }

  async isVisible(): Promise<boolean> {
    return this.root.isVisible()
  }

  async waitForVisible(): Promise<void> {
    await this.root.waitFor({ state: 'visible' })
  }

  async waitForHidden(): Promise<void> {
    await this.root.waitFor({ state: 'hidden' })
  }
}

export class QueuePanel {
  readonly overlayToggle: Locator
  readonly moreOptionsButton: Locator
  readonly clearHistoryDialog: QueueClearHistoryDialog

  constructor(readonly page: Page) {
    this.overlayToggle = page.getByTestId(TestIds.queue.overlayToggle)
    this.moreOptionsButton = page.getByLabel(/More options/i).first()
    this.clearHistoryDialog = new QueueClearHistoryDialog(page)
  }

  async openClearHistoryDialog() {
    await this.moreOptionsButton.click()

    const clearHistoryAction = this.page.getByTestId(
      TestIds.queue.clearHistoryAction
    )
    await expect(clearHistoryAction).toBeVisible()
    await clearHistoryAction.click()
  }
}