import type { Locator, Page } from '@playwright/test'

import { comfyExpect as expect } from '../ComfyPage'
import { TestIds } from '../selectors'

export class QueuePanel {
  readonly overlayToggle: Locator
  readonly moreOptionsButton: Locator

  constructor(readonly page: Page) {
    this.overlayToggle = page.getByTestId(TestIds.queue.overlayToggle)
    this.moreOptionsButton = page.getByLabel(/More options/i).first()
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
