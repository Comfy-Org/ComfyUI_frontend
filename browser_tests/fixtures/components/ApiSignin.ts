import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import { TestIds } from '@e2e/fixtures/selectors'

export class ApiSignin extends BaseDialog {
  readonly cancel: Locator

  constructor(page: Page) {
    super(page, TestIds.dialogs.apiSignin)
    this.cancel = this.root.getByRole('button', { name: 'Cancel' })
  }
  async open(nodes: string[] = []) {
    const result = this.page.evaluate(
      (nodes) =>
        window.app!.extensionManager.dialog.showApiNodesSignInDialog(nodes),
      nodes
    )
    await this.waitForVisible()
    return { result }
  }
}
