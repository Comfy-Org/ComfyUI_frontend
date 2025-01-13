import { Locator, Page } from '@playwright/test'

export class Topbar {
  constructor(public readonly page: Page) {}

  async getTabNames(): Promise<string[]> {
    return await this.page
      .locator('.workflow-tabs .workflow-label')
      .allInnerTexts()
  }

  async getActiveTabName(): Promise<string> {
    return this.page
      .locator('.workflow-tabs .p-togglebutton-checked')
      .innerText()
  }

  async openSubmenuMobile() {
    await this.page.locator('.p-menubar-mobile .p-menubar-button').click()
  }

  getMenuItem(itemLabel: string): Locator {
    return this.page.locator(`.p-menubar-item-label:text-is("${itemLabel}")`)
  }

  getWorkflowTab(tabName: string): Locator {
    return this.page
      .locator(`.workflow-tabs .workflow-label:has-text("${tabName}")`)
      .locator('..')
  }

  async closeWorkflowTab(tabName: string) {
    const tab = this.getWorkflowTab(tabName)
    await tab.locator('.close-button').click({ force: true })
  }

  getSaveDialog(): Locator {
    return this.page.locator('.p-dialog-content input')
  }

  saveWorkflow(workflowName: string): Promise<void> {
    return this._saveWorkflow(workflowName, 'Save')
  }

  saveWorkflowAs(workflowName: string): Promise<void> {
    return this._saveWorkflow(workflowName, 'Save As')
  }

  exportWorkflow(workflowName: string): Promise<void> {
    return this._saveWorkflow(workflowName, 'Export')
  }

  async _saveWorkflow(
    workflowName: string,
    command: 'Save' | 'Save As' | 'Export'
  ) {
    await this.triggerTopbarCommand(['Workflow', command])
    await this.getSaveDialog().fill(workflowName)
    await this.page.keyboard.press('Enter')

    // Wait for workflow service to finish saving
    await this.page.waitForFunction(
      () => !window['app'].extensionManager.workflow.isBusy,
      undefined,
      { timeout: 3000 }
    )
    // Wait for the dialog to close.
    await this.getSaveDialog().waitFor({ state: 'hidden', timeout: 500 })
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
