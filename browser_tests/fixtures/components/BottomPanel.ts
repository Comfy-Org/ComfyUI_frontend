import type { Locator, Page } from '@playwright/test'

class ShortcutsTab {
  readonly essentialsTab: Locator
  readonly viewControlsTab: Locator
  readonly manageButton: Locator
  readonly keyBadges: Locator
  readonly subcategoryTitles: Locator

  constructor(readonly page: Page) {
    this.essentialsTab = page.getByRole('tab', { name: /Essential/i })
    this.viewControlsTab = page.getByRole('tab', { name: /View Controls/i })
    this.manageButton = page.getByRole('button', { name: /Manage Shortcuts/i })
    this.keyBadges = page.locator('.key-badge')
    this.subcategoryTitles = page.locator('.subcategory-title')
  }
}

export class BottomPanel {
  readonly root: Locator
  readonly keyboardShortcutsButton: Locator
  readonly toggleButton: Locator
  readonly closeButton: Locator
  readonly resizeGutter: Locator
  readonly shortcuts: ShortcutsTab

  constructor(readonly page: Page) {
    this.root = page.locator('.bottom-panel')
    this.keyboardShortcutsButton = page.getByRole('button', {
      name: /Keyboard Shortcuts/i
    })
    this.toggleButton = page.getByRole('button', {
      name: /Toggle Bottom Panel/i
    })
    this.closeButton = this.root.getByRole('button', { name: /^Close$/i })
    // PrimeVue renders the splitter gutter outside the panel body.
    this.resizeGutter = page.locator(
      '.splitter-overlay-bottom > .p-splitter-gutter'
    )
    this.shortcuts = new ShortcutsTab(page)
  }

  async resizeByDragging(deltaY: number): Promise<void> {
    const gutterBox = await this.resizeGutter.boundingBox()
    if (!gutterBox) {
      throw new Error('Bottom panel resize gutter should have layout')
    }

    const gutterCenterX = gutterBox.x + gutterBox.width / 2
    const gutterCenterY = gutterBox.y + gutterBox.height / 2

    await this.page.mouse.move(gutterCenterX, gutterCenterY)
    await this.page.mouse.down()
    await this.page.mouse.move(gutterCenterX, gutterCenterY + deltaY, {
      steps: 5
    })
    await this.page.mouse.up()
  }
}
