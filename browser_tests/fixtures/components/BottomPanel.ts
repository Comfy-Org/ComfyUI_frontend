import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

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

export class LogsTab {
  readonly tab: Locator
  readonly terminalRoot: Locator
  readonly terminalHost: Locator
  readonly copyButton: Locator
  readonly errorMessage: Locator
  readonly loadingSpinner: Locator
  readonly xtermScreen: Locator

  constructor(readonly page: Page) {
    this.tab = page.getByRole('tab', { name: /Logs/i })
    this.terminalRoot = page.getByTestId(TestIds.terminal.root)
    this.terminalHost = page.getByTestId(TestIds.terminal.host)
    this.copyButton = page.getByTestId(TestIds.terminal.copyButton)
    this.errorMessage = page.getByTestId(TestIds.terminal.logsErrorMessage)
    this.loadingSpinner = page.getByTestId(TestIds.terminal.logsLoadingSpinner)
    this.xtermScreen = this.terminalHost.locator('.xterm-screen')
  }

  async activate() {
    await this.tab.click()
  }
}

export class BottomPanel {
  readonly root: Locator
  readonly keyboardShortcutsButton: Locator
  readonly toggleButton: Locator
  readonly closeButton: Locator
  readonly shortcuts: ShortcutsTab
  readonly logs: LogsTab

  constructor(readonly page: Page) {
    this.root = page.locator('.bottom-panel')
    this.keyboardShortcutsButton = page.getByRole('button', {
      name: /Keyboard Shortcuts/i
    })
    this.toggleButton = page.getByRole('button', {
      name: /Toggle Bottom Panel/i
    })
    this.closeButton = this.root.getByRole('button', { name: /close/i })
    this.shortcuts = new ShortcutsTab(page)
    this.logs = new LogsTab(page)
  }

  async open() {
    await this.toggleButton.click()
  }

  async openLogsTab() {
    await this.open()
  }
}
