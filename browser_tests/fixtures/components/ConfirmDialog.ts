import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '../../types/globals'

type KeysOfType<T, Match> = {
  [K in keyof T]: T[K] extends Match ? K : never
}[keyof T]

/**
 * Page object for the generic confirm dialog shown via `dialogService.confirm()`.
 *
 * Accessible on `comfyPage.confirmDialog`.
 */
export class ConfirmDialog {
  readonly root: Locator
  readonly delete: Locator
  readonly overwrite: Locator
  /** Cancel / reject button */
  readonly reject: Locator
  /** Primary confirm button */
  readonly confirm: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.delete = this.root.getByRole('button', { name: 'Delete' })
    this.overwrite = this.root.getByRole('button', { name: 'Overwrite' })
    this.reject = this.root.getByRole('button', { name: 'Cancel' })
    this.confirm = this.root.getByRole('button', { name: 'Confirm' })
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

  async click(locator: KeysOfType<ConfirmDialog, Locator>) {
    const loc = this[locator]
    await loc.waitFor({ state: 'visible' })
    await loc.click()

    // Wait for the dialog mask to disappear after confirming
    const mask = this.page.locator('.p-dialog-mask')
    const count = await mask.count()
    if (count > 0) {
      await mask.first().waitFor({ state: 'hidden', timeout: 3000 })
    }

    // Wait for workflow service to finish if it's busy
    await this.page.waitForFunction(
      () =>
        (window.app?.extensionManager as WorkspaceStore | undefined)?.workflow
          ?.isBusy === false,
      undefined,
      { timeout: 3000 }
    )
  }
}