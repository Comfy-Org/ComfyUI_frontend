import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { escapeRegExp } from 'es-toolkit'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import frMessages from '@/locales/fr/main.json' with { type: 'json' }

import { TestIds } from '@e2e/fixtures/selectors'

export class AgentPanel {
  public readonly root: Locator
  public readonly dockedPanel: Locator
  public readonly openButton: Locator
  public readonly closeButton: Locator
  public readonly debugHeading: Locator
  public readonly serverLogsSwitch: Locator
  public readonly settingsSwitch: Locator
  public readonly workflowSwitch: Locator
  public readonly copyReportButton: Locator
  public readonly copiedButton: Locator
  public readonly workflowPicker: Locator
  public readonly fileInput: Locator
  public readonly composerAssetSection: Locator
  public readonly scrollAssetsRight: Locator
  public readonly attachmentChips: Locator
  public readonly composer: Locator
  public readonly composerPromptArea: Locator
  public readonly sendButton: Locator
  public readonly stopButton: Locator
  public readonly creditsExhaustedPaywall: Locator
  public readonly workSummary: Locator
  public readonly nodeSelectionBanner: Locator
  public readonly activityRows: Locator

  constructor(private readonly page: Page) {
    this.root = page.locator('#agent-panel-root')
    this.dockedPanel = page.getByTestId('docked-agent-panel')
    this.openButton = page.getByRole('button', {
      name: enMessages.agent.entryButton,
      exact: true
    })
    this.closeButton = this.root
      .locator('header')
      .getByRole('button', { name: enMessages.g.close, exact: true })
      .or(
        this.root.locator('header').getByRole('button', {
          name: frMessages.g.close,
          exact: true
        })
      )
    this.debugHeading = this.root.getByText('CRDT debug', { exact: true })
    this.serverLogsSwitch = this.root.getByRole('switch', {
      name: 'Server logs'
    })
    this.settingsSwitch = this.root.getByRole('switch', { name: 'Settings' })
    this.workflowSwitch = this.root.getByRole('switch', {
      name: 'Workflow JSON'
    })
    this.copyReportButton = this.root.getByRole('button', {
      name: 'Copy full report'
    })
    this.copiedButton = this.root.getByRole('button', { name: 'Copied' })
    // Locale-agnostic, like `closeButton` above: a spec that seeds a non-English
    // `Comfy.Locale` before load still has to reach the picker to set up, and an
    // English-only name silently turns that into a timeout inside fixture setup.
    this.workflowPicker = this.root
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .or(
        this.root.getByRole('button', {
          name: frMessages.agent.switchWorkflow
        })
      )
    this.fileInput = this.root.getByTestId('agent-file-input')
    this.composerAssetSection = this.root.getByTestId('composer-asset-section')
    this.scrollAssetsRight = this.root.getByRole('button', {
      name: enMessages.g.scrollRight
    })
    this.attachmentChips = this.root.getByTestId('agent-attachment-chip')
    this.composer = this.root.getByRole('textbox', { name: /^Describe ideas/ })
    this.composerPromptArea = this.root.getByTestId('composer-inline-input')
    this.sendButton = this.root.getByRole('button', {
      name: enMessages.agent.send
    })
    this.stopButton = this.root.getByRole('button', {
      name: enMessages.agent.stop,
      exact: true
    })
    this.creditsExhaustedPaywall = this.root.getByRole('alert').filter({
      hasText: enMessages.agent.paywall.title
    })
    this.workSummary = this.root.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(enMessages.agent.worked)}`)
    })
    this.nodeSelectionBanner = page.getByTestId('node-selection-mode-banner')
    this.activityRows = this.root
      .getByTestId(TestIds.agent.activityTrace)
      .getByRole('listitem')
  }

  async scrollAssetsToEnd(): Promise<void> {
    const count = await this.attachmentChips.count()
    for (
      let step = 0;
      step < count && (await this.scrollAssetsRight.isEnabled());
      step++
    ) {
      const target = await this.composerAssetSection.evaluate((element) =>
        Math.min(
          element.scrollWidth - element.clientWidth,
          element.scrollLeft + element.clientWidth
        )
      )
      await this.scrollAssetsRight.click()
      await expect
        .poll(() =>
          this.composerAssetSection.evaluate((element) => element.scrollLeft)
        )
        .toBeCloseTo(target, 0)
    }
    await expect(this.scrollAssetsRight).toBeDisabled()
  }

  activityRow(label: string): Locator {
    return this.activityRows.getByText(label, { exact: true })
  }

  assetPreview(name: string): Locator {
    return this.page.getByRole('dialog', { name, exact: true })
  }

  previewAssetButton(name: string): Locator {
    return this.attachmentChip(name).getByRole('button', {
      name: enMessages.agent.previewAsset.replace('{name}', name),
      exact: true
    })
  }

  async expectAttachmentFullyVisible(name: string): Promise<void> {
    const tray = this.root.getByRole('region', {
      name: enMessages.assetBrowser.assets,
      exact: true
    })
    await expect
      .poll(async () => {
        const [card, viewport] = await Promise.all([
          this.attachmentChip(name).boundingBox(),
          tray.boundingBox()
        ])
        return (
          !!card &&
          !!viewport &&
          card.y >= viewport.y &&
          card.y + card.height <= viewport.y + viewport.height
        )
      })
      .toBe(true)
  }

  /**
   * The composer attachment carrying `name`.
   *
   * `name` is a filename and may legitimately contain a quote or backslash, so
   * it is escaped for the double-quoted CSS string rather than interpolated
   * raw: unescaped, such a name yields an invalid selector or matches the
   * wrong chip. `CSS.escape` is a DOM API and is not available here.
   */
  attachmentChip(name: string): Locator {
    // `/./gsu` visits every code point without putting a control character
    // literal in the pattern, which keeps both no-control-regex and
    // no-misused-spread satisfied.
    const escaped = name.replace(/./gsu, (char) => {
      if (char === '"' || char === '\\') return `\\${char}`
      const code = char.codePointAt(0)!
      return code < 0x20 || code === 0x7f ? `\\${code.toString(16)} ` : char
    })
    return this.attachmentChips.and(
      this.page.locator(`[data-attachment-name="${escaped}"]`)
    )
  }

  async open(timeout?: number): Promise<Locator> {
    if (await this.root.isVisible()) return this.root

    const dropClickIfAlreadyOpen = await this.openButton.evaluateHandle(
      (button) => {
        const listener = (event: Event) => {
          if (button.getAttribute('aria-pressed') === 'true')
            event.stopImmediatePropagation()
        }
        button.addEventListener('click', listener, true)
        return listener
      }
    )
    try {
      await expect(async () => {
        if (await this.root.isVisible()) return
        await this.openButton.click({ timeout: 1_000 })
      }).toPass({ timeout })
    } finally {
      await this.openButton.evaluate(
        (button, listener) =>
          button.removeEventListener('click', listener, true),
        dropClickIfAlreadyOpen
      )
      await dropClickIfAlreadyOpen.dispose()
    }

    await expect(this.root).toBeVisible({ timeout })
    return this.root
  }

  async close(): Promise<void> {
    await this.closeButton.click()
    await expect(this.root).toHaveCount(0)
  }

  async expectPanelSize(expected: { x: number; width: number }): Promise<void> {
    await expect
      .poll(async () => {
        const box = await this.dockedPanel.boundingBox()
        return box && { x: box.x, width: box.width }
      })
      .toEqual(expected)
  }

  /**
   * Picks the target without waiting for the picker label, which settles only
   * once the target's save completes.
   */
  async chooseWorkflow(name: string = 'Unsaved Workflow'): Promise<void> {
    await this.workflowPicker.click()
    await this.page.getByRole('menuitemradio', { name, exact: true }).click()
  }

  async selectWorkflow(name: string = 'Unsaved Workflow'): Promise<void> {
    await this.chooseWorkflow(name)
    await expect(this.workflowPicker).toHaveText(name)
  }

  async openWorkSummary(): Promise<void> {
    await this.workSummary.click()
    await expect(this.workSummary).toHaveAttribute('aria-expanded', 'true')
  }

  async reload(): Promise<void> {
    await this.page.reload()
    await expect(
      this.page.getByTestId(TestIds.topbar.integratedTabBarActions)
    ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 30_000 })
    await expect(this.root).toBeVisible({ timeout: 30_000 })
  }

  /** Clicks the empty bottom-left corner of the prompt area, below any text. */
  async clickBelowFirstPromptLine(): Promise<void> {
    const box = await this.composerPromptArea.boundingBox()
    if (!box) throw new Error('Composer prompt area is not visible')
    await this.composerPromptArea.click({
      position: { x: 8, y: box.height - 6 }
    })
  }

  async sendMessage(message: string): Promise<void> {
    await this.composer.fill(message)
    await this.sendButton.click()
  }

  async enterNodeSelectionMode(): Promise<void> {
    await this.open()
    await this.selectWorkflow()
    await this.root
      .getByRole('button', { name: enMessages.agent.addToPrompt })
      .click()
    await this.page
      .getByRole('menuitem', { name: enMessages.agent.nodes })
      .click()
    await expect(this.nodeSelectionBanner).toBeVisible()
  }

  async exitNodeSelectionMode(): Promise<void> {
    await this.nodeSelectionBanner
      .getByRole('button', { name: enMessages.agent.nodeSelection.exit })
      .click()
    await expect(this.nodeSelectionBanner).toHaveCount(0)
  }

  async turnOffOptionalReportSources(): Promise<void> {
    await this.serverLogsSwitch.click()
    await this.settingsSwitch.click()
    await this.workflowSwitch.click()
  }
}
