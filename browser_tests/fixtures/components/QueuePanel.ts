import type { Locator, Page } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class QueuePanel {
  readonly overlayToggle: Locator
  readonly overlay: Locator
  readonly moreOptionsButton: Locator

  constructor(readonly page: Page) {
    this.overlayToggle = page.getByTestId(TestIds.queue.overlayToggle)
    this.overlay = page.getByTestId(TestIds.queue.progressOverlay)
    this.moreOptionsButton = this.overlay.getByLabel(/More options/i)
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
