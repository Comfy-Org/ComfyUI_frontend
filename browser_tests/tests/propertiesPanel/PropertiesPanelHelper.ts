import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TitleEditor } from '@e2e/fixtures/components/TitleEditor'
import { TestIds } from '@e2e/fixtures/selectors'

export class PropertiesPanelHelper {
  readonly root: Locator
  readonly panelTitle: Locator
  readonly searchBox: Locator
  readonly closeButton: Locator
  readonly titleEditor: TitleEditor
  readonly pinnedSwitch: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId(TestIds.propertiesPanel.root)
    this.panelTitle = this.root.locator('h3')
    this.searchBox = this.root.getByPlaceholder(/^Search/)
    this.closeButton = this.root.locator('button[aria-pressed]')
    this.titleEditor = new TitleEditor(this.root)
    this.pinnedSwitch = this.root.getByRole('switch', { name: 'Pinned' })
  }

  get tabs(): Locator {
    return this.root.locator('nav button')
  }

  getTab(label: string): Locator {
    return this.root.locator('nav button', { hasText: label })
  }

  get titleEditIcon(): Locator {
    return this.panelTitle.locator('i[class*="lucide--pencil"]')
  }

  getNodeStateButton(state: 'Normal' | 'Bypass' | 'Mute'): Locator {
    return this.root.locator('button', { hasText: state })
  }

  getColorSwatch(colorName: string): Locator {
    return this.root.locator(`[data-testid="${colorName}"]`)
  }

  get subgraphEditButton(): Locator {
    return this.root.locator('button:has(i[class*="lucide--settings-2"])')
  }

  get contentArea(): Locator {
    return this.root.locator('.scrollbar-thin')
  }

  /** Draggable widget rows of the first widgets section in the panel. */
  get sectionWidgetRows(): Locator {
    return this.root
      .getByTestId('section-widgets-list')
      .first()
      .locator('.widget-item')
  }

  /**
   * Drag the widget row at `fromIndex` down onto the row at `toIndex`.
   * Grabs the row by its header strip (`y + 8`): the widget body owns its own
   * pointer events, but the header is pointer-events-none so the grab lands on
   * the draggable row itself.
   */
  async dragSectionWidgetRow(
    fromIndex: number,
    toIndex: number
  ): Promise<void> {
    const rows = this.sectionWidgetRows
    const from = await rows.nth(fromIndex).boundingBox()
    const to = await rows.nth(toIndex).boundingBox()
    if (!from || !to) throw new Error('widget row not visible')

    const { mouse } = this.page
    await mouse.move(from.x + from.width / 2, from.y + 8)
    await mouse.down()
    await mouse.move(to.x + to.width / 2, to.y + to.height * 0.95, {
      steps: 20
    })
    await mouse.up()
  }

  get errorsTabIcon(): Locator {
    return this.root.locator('nav i[class*="lucide--octagon-alert"]')
  }

  get viewAllSettingsButton(): Locator {
    return this.root.getByRole('button', { name: /view all settings/i })
  }

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
      await expect(this.root).toBeHidden()
    }
  }

  async switchToTab(label: string): Promise<void> {
    await this.getTab(label).click()
  }

  async editTitle(newTitle: string): Promise<void> {
    await this.titleEditIcon.click()
    await this.titleEditor.expectVisible()
    await this.titleEditor.setTitle(newTitle)
  }

  async searchWidgets(query: string): Promise<void> {
    await this.searchBox.fill(query)
  }

  async clearSearch(): Promise<void> {
    await this.searchBox.fill('')
  }
}
