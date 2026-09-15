import type { Locator, Page } from '@playwright/test'

export class BaseDialog {
  readonly root: Locator
  readonly closeButton: Locator

  /**
   * @param testIdOrRoot - A `data-testid` to scope the dialog root by, a
   * pre-built `Locator` (e.g. for a dialog identified by content rather than
   * a testid), or omitted to fall back to the generic `[role="dialog"]`.
   * The generic fallback matches *every* open dialog when more than one is
   * stacked (e.g. a dialog opened from within Settings) — prefer a specific
   * testid or Locator whenever the dialog can be reached alongside another.
   */
  constructor(
    public readonly page: Page,
    testIdOrRoot?: string | Locator
  ) {
    this.root =
      typeof testIdOrRoot === 'string'
        ? page.getByTestId(testIdOrRoot)
        : (testIdOrRoot ?? page.getByRole('dialog'))
    this.closeButton = this.root.getByRole('button', { name: 'Close' })
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

  async close(): Promise<void> {
    await this.closeButton.click()
    await this.waitForHidden()
  }
}
