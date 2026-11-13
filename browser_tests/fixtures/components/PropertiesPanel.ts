import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TitleEditor } from '@e2e/fixtures/components/TitleEditor'
import { TestIds } from '@e2e/fixtures/selectors'

export class PropertiesPanel {
  readonly root: Locator
  readonly panelTitle: Locator
  readonly searchBox: Locator
  readonly toggleButton: Locator
  readonly closeButton: Locator
  readonly expandAllButton: Locator
  readonly collapseAllButton: Locator
  readonly errorsTab: Locator
  readonly titleEditor: TitleEditor
  readonly pinnedSwitch: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId(TestIds.propertiesPanel.root)
    this.panelTitle = this.root.locator('h3')
    this.searchBox = this.root.getByPlaceholder(/^Search/)
    this.toggleButton = page.getByRole('button', {
      name: 'Toggle properties panel'
    })
    this.closeButton = this.root.getByRole('button', {
      name: 'Toggle properties panel'
    })
    this.expandAllButton = this.root.getByRole('button', { name: 'Expand all' })
    this.collapseAllButton = this.root.getByRole('button', {
      name: 'Collapse all'
    })
    this.errorsTab = this.root.getByTestId(TestIds.propertiesPanel.errorsTab)
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

  get sectionWidgetsLists(): Locator {
    return this.root.getByTestId('section-widgets-list')
  }

  get sectionWidgetsList(): Locator {
    return this.sectionWidgetsLists.first()
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
    return this.sectionWidgetsList.locator('.widget-item')
  }

  get widgetActionsButtons(): Locator {
    return this.root.getByTestId(TestIds.subgraphEditor.widgetActionsMenuButton)
  }

  get widgetActionsMenu(): Locator {
    return this.page.getByRole('menu')
  }

  widgetAction(name: string): Locator {
    return this.widgetActionsMenu.getByRole('menuitem', { name, exact: true })
  }

  async widgetActionLabelLeft(name: string): Promise<number> {
    return this.widgetAction(name)
      .getByText(name, { exact: true })
      .evaluate((element) => element.getBoundingClientRect().left)
  }

  /** Drag the widget row at `fromIndex` down onto the row at `toIndex`. */
  async dragSectionWidgetRow(
    fromIndex: number,
    toIndex: number
  ): Promise<void> {
    await expect(this.sectionWidgetsList).toHaveAttribute(
      'data-draggable-ready',
      'true'
    )

    const rows = this.sectionWidgetRows
    await rows.nth(fromIndex).scrollIntoViewIfNeeded()
    const from = await rows.nth(fromIndex).boundingBox()
    const to = await rows.nth(toIndex).boundingBox()
    if (!from || !to) throw new Error('widget row not visible')

    const { mouse } = this.page
    const headerStripOffsetY = 8
    const viewport = this.page.viewportSize()
    if (!viewport) throw new Error('page has no viewport')
    const dropY = Math.min(to.y + to.height * 0.95, viewport.height - 1)

    await mouse.move(from.x + from.width / 2, from.y + headerStripOffsetY)
    await mouse.down()
    try {
      await expect(rows.nth(fromIndex)).toHaveClass(/\bis-draggable\b/)
      await mouse.move(to.x + to.width / 2, dropY, {
        steps: 20
      })
      await expect
        .poll(async () => {
          await mouse.move(to.x + to.width / 2, dropY)
          return rows.nth(toIndex).getAttribute('data-is-toggled')
        })
        .toBe('')
    } finally {
      await mouse.up()
    }
  }

  get errorsTabIcon(): Locator {
    return this.errorsTab.getByTestId('panel-tab-icon')
  }

  get viewAllSettingsButton(): Locator {
    return this.root.getByRole('button', { name: /view all settings/i })
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
