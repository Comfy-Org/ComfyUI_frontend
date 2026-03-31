import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'
import { TestIds } from '../selectors'

export class MobileAppHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  get view(): Locator {
    return this.page.getByTestId(TestIds.linear.mobile)
  }
  get navigation(): Locator {
    return this.page.getByRole('tablist').filter({ hasText: 'Run' })
  }
  get workflows() {
    return this.view.getByTestId(TestIds.linear.mobileWorkflows)
  }
  get actionmenu() {
    return this.view.getByTestId(TestIds.linear.mobileActionMenu)
  }
  get navigationTabs() {
    return this.navigation.getByRole('tab')
  }
  get contentPanel() {
    return this.page.getByRole('tabpanel')
  }

  async switchWorkflow(workflowName: string) {
    await this.workflows.click()
    await this.page.getByRole('menu').getByText(workflowName).click()
  }
  async navigateTab(name: 'run' | 'outputs' | 'assets') {
    await this.navigation.getByRole('tab', { name }).click()
  }
  private get page(): Page {
    return this.comfyPage.page
  }
}
