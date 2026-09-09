import type { Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import { TestIds } from '@e2e/fixtures/selectors'

export class ApiSignin extends BaseDialog {
  constructor(page: Page) {
    super(page, TestIds.dialogs.apiSignin)
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
