import type { Locator, Page } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class QueuePanel {
  readonly overlayToggle: Locator
  readonly overlay: Locator
  readonly progressNodeFill: Locator
  readonly moreOptionsButton: Locator
  readonly jobAssetsList: Locator
  readonly menu: Locator
  readonly dockedHistoryAction: Locator
  readonly runProgressAction: Locator
  readonly clearHistoryAction: Locator
  readonly filterButton: Locator
  readonly sortButton: Locator

  constructor(readonly page: Page) {
    this.overlayToggle = page.getByTestId(TestIds.queue.overlayToggle)
    this.overlay = page.getByTestId(TestIds.queue.progressOverlay)
    this.progressNodeFill = this.overlay.getByTestId(
      TestIds.queue.progressNodeFill
    )
    this.moreOptionsButton = this.overlay.getByLabel(/More options/i)
    this.jobAssetsList = page.getByTestId(TestIds.queue.jobAssetsList)
    this.menu = page.getByRole('menu')
    this.dockedHistoryAction = page.getByRole('menuitemcheckbox', {
      name: 'Docked Job History'
    })
    this.runProgressAction = page.getByRole('menuitemcheckbox', {
      name: 'Show run progress bar'
    })
    this.clearHistoryAction = page.getByRole('menuitem', {
      name: 'Clear job history',
      exact: true
    })
    this.filterButton = this.overlay.getByRole('button', {
      name: 'Filter jobs'
    })
    this.sortButton = this.overlay.getByRole('button', { name: 'Sort jobs' })
  }

  menuOption(label: string): Locator {
    return this.menu.getByRole('menuitemradio', { name: label, exact: true })
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

    const addToWorkflowButton = this.page.getByRole('menuitem', {
      name: 'Add to current workflow',
      exact: true
    })
    await expect(addToWorkflowButton).toBeVisible()
    await addToWorkflowButton.click()
    await expect(addToWorkflowButton).toBeHidden()
  }

  async openClearHistoryDialog() {
    await this.moreOptionsButton.click()
    await this.clearHistoryAction.click()
  }
}
