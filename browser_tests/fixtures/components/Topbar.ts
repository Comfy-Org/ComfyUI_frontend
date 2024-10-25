import { Locator, Page } from '@playwright/test'

export class Topbar {
  constructor(public readonly page: Page) {}

  async getTabNames(): Promise<string[]> {
    return await this.page
      .locator('.workflow-tabs .workflow-label')
      .allInnerTexts()
  }

  async openSubmenuMobile() {
    await this.page.locator('.p-menubar-mobile .p-menubar-button').click()
  }

  async getMenuItem(itemLabel: string): Promise<Locator> {
    return this.page.locator(`.p-menubar-item-label:text-is("${itemLabel}")`)
  }

  async getWorkflowTab(tabName: string): Promise<Locator> {
    return this.page
      .locator(`.workflow-tabs .workflow-label:has-text("${tabName}")`)
      .locator('..')
  }

  async closeWorkflowTab(tabName: string) {
    const tab = await this.getWorkflowTab(tabName)
    await tab.locator('.close-button').click({ force: true })
  }

  async saveWorkflow(workflowName: string) {
    await this.triggerTopbarCommand(['Workflow', 'Save'])
    await this.page.locator('.p-dialog-content input').fill(workflowName)
    await this.page.keyboard.press('Enter')
    // Wait for the dialog to close.
    await this.page.waitForTimeout(300)
  }

  async triggerTopbarCommand(path: string[]) {
    if (path.length < 2) {
      throw new Error('Path is too short')
    }

    const tabName = path[0]
    const topLevelMenu = this.page.locator(
      `.top-menubar .p-menubar-item-label:text-is("${tabName}")`
    )
    await topLevelMenu.waitFor({ state: 'visible' })
    await topLevelMenu.click()

    for (let i = 1; i < path.length; i++) {
      const commandName = path[i]
      const menuItem = this.page
        .locator(
          `.top-menubar .p-menubar-submenu .p-menubar-item:has-text("${commandName}")`
        )
        .first()
      await menuItem.waitFor({ state: 'visible' })
      await menuItem.hover()

      if (i === path.length - 1) {
        await menuItem.click()
      }
    }
  }
}
