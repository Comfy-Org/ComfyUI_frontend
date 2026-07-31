import type { Locator, Page } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class QueuePanel {
  readonly overlayToggle: Locator
  readonly overlay: Locator
  readonly moreOptionsButton: Locator
  readonly jobAssetsList: Locator

  constructor(readonly page: Page) {
    this.overlayToggle = page.getByTestId(TestIds.queue.overlayToggle)
    this.overlay = page.getByTestId(TestIds.queue.progressOverlay)
    this.moreOptionsButton = this.overlay.getByLabel(/More options/i)
    this.jobAssetsList = page.getByTestId(TestIds.queue.jobAssetsList)
  }

  jobRow(jobId: string): Locator {
    return this.jobAssetsList.locator(`[data-job-id="${jobId}"]`)
  }

  async open() {
    await this.overlayToggle.click()
    await expect(this.jobAssetsList).toBeVisible()
  }

  async addOutputToCurrentWorkflow(jobId: string) {
    const jobRow = this.jobRow(jobId)
    await expect(jobRow).toBeVisible()
    await jobRow.hover()

    const moreButton = jobRow.getByRole('button', {
      name: 'More',
      exact: true
    })
    await expect(moreButton).toBeVisible()
    await moreButton.click()

    const addToWorkflowButton = this.page.getByRole('button', {
      name: 'Add to current workflow',
      exact: true
    })
    await expect(addToWorkflowButton).toBeVisible()
    await addToWorkflowButton.click()
    await expect(addToWorkflowButton).toBeHidden()
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
