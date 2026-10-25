import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class AccountMenu {
  public readonly trigger: Locator
  public readonly menu: Locator
  public readonly workspaceSwitcher: Locator
  public readonly workspaceList: Locator

  constructor(page: Page) {
    this.trigger = page
      .getByTestId('desktop-nav-cta')
      .getByTestId('header-account')
    this.menu = page.getByTestId('header-account-menu')
    this.workspaceSwitcher = page.getByTestId('account-workspace')
    this.workspaceList = page.getByTestId('account-workspaces')
  }

  workspaceItem(workspaceId: string): Locator {
    return this.workspaceList.getByTestId(`account-workspace-${workspaceId}`)
  }

  async open(): Promise<void> {
    if (!(await this.menu.isVisible())) await this.trigger.click()
    await expect(this.menu).toBeVisible()
  }

  async pickWorkspace(workspaceId: string): Promise<void> {
    await this.open()
    if (!(await this.workspaceList.isVisible()))
      await this.workspaceSwitcher.click()
    await expect(this.workspaceList).toBeVisible()
    await this.workspaceItem(workspaceId).click()
  }
}
