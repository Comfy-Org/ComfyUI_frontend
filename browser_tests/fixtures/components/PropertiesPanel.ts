import type { Locator, Page } from '@playwright/test'

export class PropertiesPanel {
  readonly root: Locator
  readonly panelTitle: Locator
  readonly searchBox: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId('properties-panel')
    this.panelTitle = this.root.locator('h3')
    this.searchBox = this.root.getByPlaceholder('Search...')
  }

  async ensureOpen() {
    const isOpen = await this.root.isVisible()
    if (!isOpen) {
      await this.page.getByLabel('Toggle properties panel').click()
      await this.root.waitFor({ state: 'visible' })
    }
  }

  async close() {
    const isOpen = await this.root.isVisible()
    if (isOpen) {
      await this.page.getByLabel('Toggle properties panel').click()
      await this.root.waitFor({ state: 'hidden' })
    }
  }

  async promoteWidget(widgetName: string) {
    await this.ensureOpen()

    // Check if widget is already visible in Advanced Inputs section
    const widgetRow = this.root
      .locator('[class*="widget-item"], [class*="input-item"]')
      .filter({ hasText: widgetName })
      .first()
    const isAdvancedExpanded = await widgetRow.isVisible()

    if (!isAdvancedExpanded) {
      // Click on Advanced Inputs to expand it
      const advancedInputsButton = this.root
        .getByRole('button')
        .filter({ hasText: /advanced inputs/i })
      await advancedInputsButton.click()
      await widgetRow.waitFor({ state: 'visible', timeout: 5000 })
    }

    // Find and click the more options button
    const moreButton = widgetRow.locator('button').filter({
      has: this.page.locator('[class*="lucide--more-vertical"]')
    })
    await moreButton.click()

    // Click "Show input" to promote the widget
    await this.page.getByText('Show input').click()

    // Close and reopen panel to refresh the UI state
    await this.close()
    await this.ensureOpen()
  }

  async demoteWidget(widgetName: string) {
    await this.ensureOpen()

    // Check if INPUTS section content is already visible
    const widgetRow = this.root.locator('span').getByText(widgetName).first()
    const isInputsExpanded = await widgetRow.isVisible()

    if (!isInputsExpanded) {
      // Click on INPUTS section to expand it (where promoted widgets appear)
      const inputsButton = this.root
        .getByRole('button')
        .filter({ hasText: /^inputs$/i })
      await inputsButton.click()
    }

    await widgetRow.waitFor({ state: 'visible', timeout: 5000 })

    // Find the more options button in the widget-item-header
    const moreButton = widgetRow
      .locator('xpath=ancestor::*[contains(@class, "widget-item-header")]')
      .locator('button')
      .filter({
        has: this.page.locator('[class*="more-vertical"], [class*="lucide"]')
      })
      .first()

    await moreButton.click()

    // Click "Hide input" to demote the widget
    await this.page.getByText('Hide input').click()
  }
}
