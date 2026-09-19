import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class AccountMenu {
  constructor(private readonly page: Page) {}

  get trigger(): Locator {
    return this.page
      .getByTestId('desktop-nav-cta')
      .getByTestId('header-account')
  }

  get menu(): Locator {
    return this.page.getByTestId('header-account-menu')
  }

  get workspaceSwitcher(): Locator {
    return this.page.getByTestId('account-workspace')
  }

  get workspaceList(): Locator {
    return this.page.getByTestId('account-workspaces')
  }

  workspaceItem(workspaceId: string): Locator {
    return this.workspaceList.getByTestId(`account-workspace-${workspaceId}`)
  }

  async open(): Promise<void> {
    await expect(this.trigger).toBeVisible()
    await expect(async () => {
      if (!(await this.menu.isVisible())) {
        await this.trigger.click({ timeout: 2_000 })
      }
      await expect(this.menu).toBeVisible({ timeout: 2_000 })
    }).toPass()
  }

  async pickWorkspace(workspaceId: string): Promise<void> {
    await this.open()
    await expect(async () => {
      if (!(await this.workspaceList.isVisible())) {
        await expect(this.workspaceSwitcher).toBeVisible({
          timeout: 2_000
        })
        await this.workspaceSwitcher.click({ timeout: 2_000 })
      }
      await expect(this.workspaceList).toBeVisible({ timeout: 2_000 })
      const item = this.workspaceItem(workspaceId)
      await expect(item).toBeAttached({ timeout: 2_000 })
      await expect(item).toBeVisible({ timeout: 2_000 })
      await expect(item).toBeEnabled({ timeout: 2_000 })
      await item.click({ timeout: 2_000 })
    }).toPass()
  }
}
