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

    // Click on Advanced Inputs to expand it
    const advancedInputsButton = this.root
      .getByRole('button')
      .filter({ hasText: /advanced inputs/i })
    await advancedInputsButton.click()

    // Find the widget row and click the more options button
    const widgetRow = this.root
      .locator('[class*="widget-item"], [class*="input-item"]')
      .filter({ hasText: widgetName })
      .first()

    const moreButton = widgetRow.locator('button').filter({
      has: this.page.locator('[class*="lucide--more-vertical"]')
    })
    await moreButton.click()

    // Click "Show input" to promote the widget
    await this.page.getByText('Show input').click()

    // Close and reopen panel to refresh the UI state
    await this.page.getByLabel('Toggle properties panel').click()
    await this.page.getByLabel('Toggle properties panel').click()
  }

  async demoteWidget(widgetName: string) {
    await this.ensureOpen()

    // Check if INPUTS section content is already visible
    const inputsContent = this.root.locator('div').filter({
      hasText: new RegExp(`^${widgetName}$`)
    })
    const isInputsExpanded = await inputsContent.first().isVisible()

    if (!isInputsExpanded) {
      // Click on INPUTS section to expand it (where promoted widgets appear)
      const inputsButton = this.root
        .getByRole('button')
        .filter({ hasText: /^inputs$/i })
      await inputsButton.click()
    }

    // Find the widget row and click the more options button
    const widgetRow = this.root
      .locator('div')
      .filter({ hasText: new RegExp(`^${widgetName}$`) })
      .first()

    await widgetRow.waitFor({ state: 'visible', timeout: 5000 })

    // Find the more options button (the vertical dots icon button)
    const moreButton = widgetRow
      .locator('..')
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
