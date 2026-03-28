import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '../fixtures/selectors'

export class PropertiesPanelHelper {
  readonly root: Locator
  readonly panelTitle: Locator
  readonly searchBox: Locator
  readonly closeButton: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId(TestIds.propertiesPanel.root)
    this.panelTitle = this.root.locator('h3')
    this.searchBox = this.root.getByPlaceholder(/^Search/)
    this.closeButton = this.root.locator('button[aria-pressed]')
  }

  /** Tab navigation locators */
  get tabs() {
    return this.root.locator('nav button')
  }

  getTab(label: string): Locator {
    return this.root.locator('nav button', { hasText: label })
  }

  /** Title editing */
  get titleEditIcon(): Locator {
    return this.panelTitle.locator('i[class*="lucide--pencil"]')
  }

  get titleInput(): Locator {
    return this.root.getByTestId(TestIds.node.titleInput)
  }

  /** Settings tab: node state buttons */
  getNodeStateButton(state: 'Normal' | 'Bypass' | 'Mute'): Locator {
    return this.root.locator('button', { hasText: state })
  }

  /** Settings tab: color swatch by name */
  getColorSwatch(colorName: string): Locator {
    return this.root.locator(`[data-testid="${colorName}"]`)
  }

  /** Settings tab: pinned toggle (PrimeVue ToggleSwitch wrapper div) */
  get pinnedSwitch(): Locator {
    return this.root.locator('[data-p-checked]').first()
  }

  /** Subgraph edit button (gear icon in header) */
  get subgraphEditButton(): Locator {
    return this.root.locator('button:has(i[class*="lucide--settings-2"])')
  }

  /** Panel content area */
  get contentArea(): Locator {
    return this.root.locator('.scrollbar-thin')
  }

  /** Errors tab indicator icon */
  get errorsTabIcon(): Locator {
    return this.root.locator('nav i[class*="lucide--octagon-alert"]')
  }

  /** Global settings: "View all settings" button */
  get viewAllSettingsButton(): Locator {
    return this.root.getByRole('button', { name: /view all settings/i })
  }

  /** Collapse/expand toggle button */
  get collapseToggleButton(): Locator {
    return this.root.locator(
      'button:has(i[class*="lucide--chevrons-down-up"]), button:has(i[class*="lucide--chevrons-up-down"])'
    )
  }

  async open(actionbar: Locator): Promise<void> {
    if (!(await this.root.isVisible())) {
      await actionbar.click()
      await expect(this.root).toBeVisible()
    }
  }

  async close(): Promise<void> {
    if (await this.root.isVisible()) {
      await this.closeButton.click()
      await expect(this.root).not.toBeVisible()
    }
  }

  async switchToTab(label: string): Promise<void> {
    await this.getTab(label).click()
  }

  async editTitle(newTitle: string): Promise<void> {
    await this.titleEditIcon.click()
    await this.titleInput.fill(newTitle)
    await this.titleInput.press('Enter')
  }

  async searchWidgets(query: string): Promise<void> {
    await this.searchBox.fill(query)
  }

  async clearSearch(): Promise<void> {
    await this.searchBox.fill('')
  }
}
