import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class QueueList {
  constructor(public readonly page: Page) {}

  get toggleButton() {
    return this.page.getByTestId('queue-toggle-button')
  }

  get inlineProgress() {
    return this.page.getByTestId('queue-inline-progress')
  }

  get overlay() {
    return this.page.getByTestId('queue-overlay')
  }

  get closeButton() {
    return this.page.getByTestId('queue-overlay-close-button')
  }

  get jobItems() {
    return this.page.getByTestId('queue-job-item')
  }

  get clearHistoryButton() {
    return this.page.getByRole('button', { name: /Clear History/i })
  }

  async open() {
    if (!(await this.overlay.isVisible())) {
      await this.toggleButton.click()
      await expect(this.overlay).toBeVisible()
    }
  }

  async close() {
    if (await this.overlay.isVisible()) {
      await this.closeButton.click()
      await expect(this.overlay).not.toBeVisible()
    }
  }

  async getJobCount(state?: string) {
    if (state) {
      return await this.page
        .locator(`[data-testid="queue-job-item"][data-job-state="${state}"]`)
        .count()
    }
    return await this.jobItems.count()
  }

  getJobAction(actionKey: string) {
    return this.page.getByTestId(`job-action-${actionKey}`)
  }
}
