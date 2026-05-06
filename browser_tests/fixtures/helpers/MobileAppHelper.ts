import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class MobileAppHelper {
  private readonly page: Page
  readonly contentPanel: Locator
  readonly navigation: Locator
  readonly navigationTabs: Locator
  readonly view: Locator
  readonly workflows: Locator

  constructor(comfyPage: ComfyPage) {
    this.page = comfyPage.page
    this.view = this.page.getByTestId(TestIds.linear.mobile)
    this.contentPanel = this.page.getByRole('tabpanel')
    this.navigation = this.page.getByRole('tablist').filter({ hasText: 'Run' })
    this.navigationTabs = this.navigation.getByRole('tab')
    this.workflows = this.view.getByTestId(TestIds.linear.mobileWorkflows)
  }

  async switchWorkflow(workflowName: string) {
    await this.workflows.click()
    await this.page.getByRole('menu').getByText(workflowName).click()
  }
  async navigateTab(name: 'run' | 'outputs' | 'assets') {
    await this.navigation.getByRole('tab', { name }).click()
  }
  async tap(locator: Locator, { count = 1 }: { count?: number } = {}) {
    for (let i = 0; i < count; i++) await locator.tap()
  }
}
