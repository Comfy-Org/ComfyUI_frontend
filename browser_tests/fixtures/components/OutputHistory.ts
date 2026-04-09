import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

const ids = TestIds.outputHistory

export class OutputHistoryComponent {
  constructor(private readonly page: Page) {}

  get outputs(): Locator {
    return this.page.getByTestId(ids.outputs)
  }

  get welcome(): Locator {
    return this.page.getByTestId(ids.welcome)
  }

  get outputInfo(): Locator {
    return this.page.getByTestId(ids.outputInfo)
  }

  get activeQueue(): Locator {
    return this.page.getByTestId(ids.activeQueue)
  }

  get queueBadge(): Locator {
    return this.page.getByTestId(ids.queueBadge)
  }

  get inProgressItems(): Locator {
    return this.page.getByTestId(ids.inProgressItem)
  }

  get historyItems(): Locator {
    return this.page.getByTestId(ids.historyItem)
  }

  get skeletons(): Locator {
    return this.page.getByTestId(ids.skeleton)
  }

  get latentPreviews(): Locator {
    return this.page.getByTestId(ids.latentPreview)
  }

  get imageOutputs(): Locator {
    return this.page.getByTestId(ids.imageOutput)
  }

  get videoOutputs(): Locator {
    return this.page.getByTestId(ids.videoOutput)
  }

  get compareOutputs(): Locator {
    return this.page.getByTestId(ids.compareOutput)
  }

  get comparePreview(): Locator {
    return this.page.getByTestId(ids.comparePreview)
  }

  get compareSlider(): Locator {
    return this.page.getByTestId(ids.compareSlider)
  }

  get batchNav(): Locator {
    return this.page.getByTestId(ids.batchNav)
  }

  /** Timeline items that are non-asset outputs (e.g. image compare). */
  get nonAssetItems(): Locator {
    return this.page.locator(
      `[data-testid="${ids.historyItem}"][data-item-kind="nonAsset"]`
    )
  }

  /** The currently selected non-asset timeline item. */
  get selectedNonAssetItem(): Locator {
    return this.page.locator(
      `[data-testid="${ids.historyItem}"][data-item-kind="nonAsset"][data-state="checked"]`
    )
  }

  /** The currently selected (checked) in-progress item. */
  get selectedInProgressItem(): Locator {
    return this.page.locator(
      `[data-testid="${ids.inProgressItem}"][data-state="checked"]`
    )
  }

  /** The currently selected (checked) history item. */
  get selectedHistoryItem(): Locator {
    return this.page.locator(
      `[data-testid="${ids.historyItem}"][data-state="checked"]`
    )
  }

  /** The header-level progress bar. */
  get headerProgressBar(): Locator {
    return this.page.getByTestId(ids.headerProgressBar)
  }

  /** The in-progress item's progress bar (inside the thumbnail). */
  get itemProgressBar(): Locator {
    return this.inProgressItems.first().getByTestId(ids.itemProgressBar)
  }

  /** Overall progress in the header bar. */
  get headerOverallProgress(): Locator {
    return this.headerProgressBar.getByTestId(ids.progressOverall)
  }

  /** Node progress in the header bar. */
  get headerNodeProgress(): Locator {
    return this.headerProgressBar.getByTestId(ids.progressNode)
  }

  /** Overall progress in the in-progress item bar. */
  get itemOverallProgress(): Locator {
    return this.itemProgressBar.getByTestId(ids.progressOverall)
  }

  /** Node progress in the in-progress item bar. */
  get itemNodeProgress(): Locator {
    return this.itemProgressBar.getByTestId(ids.progressNode)
  }
}
