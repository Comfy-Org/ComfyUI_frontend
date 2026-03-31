import type { Locator, Page } from '@playwright/test'

import { TestIds } from '../selectors'

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
}
