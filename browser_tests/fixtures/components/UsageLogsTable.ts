import type { Locator } from '@playwright/test'

import type { SettingDialog } from '@e2e/fixtures/components/SettingDialog'

/** The usage log on Settings ▸ Plan & Credits ▸ Activity. */
export class UsageLogsTable {
  public readonly root: Locator
  private readonly activityTab: Locator

  constructor(private readonly settingDialog: SettingDialog) {
    this.root = settingDialog.contentArea.getByRole('table')
    this.activityTab = settingDialog.contentArea.getByRole('button', {
      name: 'Activity',
      exact: true
    })
  }

  async open() {
    await this.settingDialog.open()
    await this.settingDialog.category('Plan & Credits').click()
    await this.activityTab.click()
  }

  row(eventType: string): Locator {
    return this.root.getByRole('row').filter({ hasText: eventType })
  }

  additionalInfoButton(eventType: string): Locator {
    return this.row(eventType).getByRole('button', { name: 'Additional Info' })
  }
}
