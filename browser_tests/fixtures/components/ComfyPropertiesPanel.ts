import type { Locator, Page } from '@playwright/test'

export class ComfyPropertiesPanel {
  readonly root: Locator
  readonly header: Locator
  readonly panelTitle: Locator
  readonly nodeTitleInput: Locator
  readonly closeButton: Locator
  readonly searchBox: Locator
  readonly tabList: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId('properties-panel')
    this.header = this.root.locator('section').first()
    this.panelTitle = this.root.locator('h3')
    this.nodeTitleInput = this.root.getByTestId('node-title-input')
    this.closeButton = this.root.getByRole('button', { name: 'Close' })
    this.searchBox = this.root.getByPlaceholder('Search...')
    this.tabList = this.root.locator('[role="tablist"]')
  }

  getTab(tabName: string): Locator {
    return this.tabList.getByRole('tab', { name: tabName })
  }

  async clickTab(tabName: string) {
    await this.getTab(tabName).click()
  }

  async close() {
    await this.closeButton.click()
  }

  async editTitle(newTitle: string) {
    await this.panelTitle.click()
    await this.nodeTitleInput.fill(newTitle)
    await this.nodeTitleInput.press('Enter')
  }

  async cancelTitleEdit() {
    await this.panelTitle.click()
    await this.nodeTitleInput.press('Escape')
  }

  getNodeSection(nodeTitle: string): Locator {
    return this.root.locator(`[data-testid="node-section-${nodeTitle}"]`)
  }

  getAccordionItem(label: string): Locator {
    return this.root.locator('.border-b', { hasText: label })
  }

  get globalSettingsSection() {
    return {
      nodes: this.getAccordionItem('Nodes'),
      canvas: this.getAccordionItem('Canvas'),
      connectionLinks: this.getAccordionItem('Connection Links'),
      viewAllSettingsButton: this.root.getByRole('button', {
        name: 'View all settings'
      })
    }
  }

  async toggleSwitch(switchLabel: string) {
    const switchContainer = this.root.locator('label', {
      hasText: switchLabel
    })
    const toggle = switchContainer.locator('button[role="switch"]')
    await toggle.click()
  }

  async getSwitchState(switchLabel: string): Promise<boolean> {
    const switchContainer = this.root.locator('label', {
      hasText: switchLabel
    })
    const toggle = switchContainer.locator('button[role="switch"]')
    const ariaChecked = await toggle.getAttribute('aria-checked')
    return ariaChecked === 'true'
  }

  get noResultsMessage(): Locator {
    return this.root.getByText('No results', { exact: false })
  }
}
