import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export class MembersSettingsPanel {
  readonly content: Locator

  constructor(private readonly page: Page) {
    this.content = page.getByTestId('settings-dialog').getByRole('main')
  }

  async open(appUrl: string): Promise<void> {
    await this.page.goto(appUrl)
    await this.page.waitForFunction(
      () => !!window.app?.extensionManager,
      null,
      {
        timeout: 45_000
      }
    )
    await this.page
      .getByRole('button', { name: /^Settings/ })
      .first()
      .click()

    const dialog = this.page.getByTestId('settings-dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('nav').getByRole('button', { name: 'Members' }).click()
    await expect(this.content.getByText('4 of 30 total members.')).toBeVisible()
  }

  memberRow(email: string): Locator {
    return this.content
      .locator('div.grid')
      .filter({ has: this.page.getByText(email, { exact: true }) })
  }

  menuButton(row: Locator): Locator {
    return row.getByRole('button', { name: 'More Options' })
  }

  async openChangeRoleSubmenu(): Promise<void> {
    const trigger = this.page.getByRole('menuitem', { name: 'Change role' })
    await expect(trigger).toBeVisible()
    await trigger.press('ArrowRight')
    await expect(
      this.page.getByRole('menuitemradio', {
        name: 'Owner',
        exact: true
      })
    ).toBeVisible()
  }
}
