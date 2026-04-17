import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'

type KeysOfType<T, Match> = {
  [K in keyof T]: T[K] extends Match ? K : never
}[keyof T]

export class ConfirmDialog {
  public readonly root: Locator
  public readonly delete: Locator
  public readonly noWarnOverwriteToggle: Locator
  public readonly overwrite: Locator
  public readonly reject: Locator
  public readonly confirm: Locator
  public readonly save: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.delete = this.root.getByRole('button', { name: 'Delete' })
    this.overwrite = this.root.getByRole('button', { name: 'Overwrite' })
    this.reject = this.root.getByRole('button', { name: 'Cancel' })
    this.confirm = this.root.getByRole('button', { name: 'Confirm' })
    this.save = this.root.getByRole('button', { name: 'Save' })
    this.noWarnOverwriteToggle = this.root.locator('#doNotAskAgain')
  }

  async click(locator: KeysOfType<ConfirmDialog, Locator>) {
    const loc = this[locator]
    await loc.waitFor({ state: 'visible' })
    await loc.click()

    // Wait for this confirm dialog to close (not all dialogs — another
    // dialog like save-as may open immediately after).
    await this.root.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})

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
