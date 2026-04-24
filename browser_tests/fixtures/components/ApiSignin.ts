import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import { TestIds } from '@e2e/fixtures/selectors'

export class ApiSignin extends BaseDialog {
  readonly cancel: Locator
  readonly login: Locator
  readonly heading: Locator
  readonly costBreakdownTitle: Locator
  readonly costPerRunHeader: Locator
  readonly totalCostLabel: Locator
  readonly rows: Locator

  constructor(page: Page) {
    super(page, TestIds.dialogs.apiSignin)
    this.cancel = this.root.getByRole('button', { name: 'Cancel' })
    this.login = this.root.getByRole('button', { name: 'Login' })
    // Prefer role / testid selectors over literal English copy — an
    // i18n-key rename or trailing-whitespace change would break exact-
    // text locators silently. The "Cost per run" sub-header still has
    // no testid (it's mostly decorative), so keep the regex for now.
    this.heading = this.root.getByRole('heading', { level: 2 })
    this.costBreakdownTitle = this.root.getByText(/API Node\(s\)/)
    this.costPerRunHeader = this.root.getByText(/Cost per run/i)
    this.totalCostLabel = this.root.getByTestId('api-nodes-total-cost')
    this.rows = this.root.getByTestId('api-node-row')
  }
  async open(nodes: string[] = []) {
    // showApiNodesSignInDialog resolves only when the user acts on the
    // dialog, so we can't await the evaluate here. Kick it off, then
    // await dialog visibility so the caller gets a confirmed-open
    // fixture — they keep the handle to await final resolution after
    // driving the UI (login / cancel / close).
    const result = this.page.evaluate(
      (nodes) =>
        window.app!.extensionManager.dialog.showApiNodesSignInDialog(nodes),
      nodes
    )
    await this.waitForVisible()
    return { result }
  }
}
