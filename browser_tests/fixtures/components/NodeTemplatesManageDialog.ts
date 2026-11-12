import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import { TestIds } from '@e2e/fixtures/selectors'

export class NodeTemplatesManageDialog extends BaseDialog {
  public readonly rows: Locator
  /**
   * Hidden `<input type="file">` used by the Import button. Attached to
   * `document.body` (not inside the dialog) by the legacy extension, so it
   * cannot be scoped via `this.root`.
   */
  public readonly importInput: Locator

  constructor(page: Page) {
    super(page, TestIds.nodeTemplates.manageDialog)
    this.rows = this.root.locator('.templateManagerRow')
    this.importInput = page.locator('input[type="file"][accept=".json"]')
  }

  rowByName(name: string): Locator {
    const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return this.rows.filter({
      has: this.page.locator(`input[data-name="${escaped}"]`)
    })
  }
}
