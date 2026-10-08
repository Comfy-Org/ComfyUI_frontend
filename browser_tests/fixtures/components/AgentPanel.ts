import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import frMessages from '@/locales/fr/main.json' with { type: 'json' }

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

  constructor(private readonly page: Page) {
    this.root = page.locator('#agent-panel-root')
    this.dockedPanel = page.getByTestId('docked-agent-panel')
    this.openButton = page.getByRole('button', {
      name: enMessages.agent.entryButton,
      exact: true
    })
    this.closeButton = this.root
      .getByRole('button', { name: enMessages.g.close, exact: true })
      .or(
        this.root.getByRole('button', {
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
    this.workflowPicker = this.root.getByRole('button', {
      name: enMessages.agent.switchWorkflow
    })
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

  async open(): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (await this.root.isVisible()) return
      await this.openButton.click()
      try {
        await expect(this.root).toBeVisible({ timeout: 1_000 })
        return
      } catch {
        // Startup activation can open between the visibility read and click,
        // making that click close the panel. Retry from the observed state.
      }
    }
    await expect(this.root).toBeVisible()
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

  async selectWorkflow(name: string = 'Unsaved Workflow'): Promise<void> {
    await this.workflowPicker.click()
    await this.page.getByRole('menuitemradio', { name, exact: true }).click()
    await expect(this.workflowPicker).toHaveText(name)
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

  async turnOffOptionalReportSources(): Promise<void> {
    await this.serverLogsSwitch.click()
    await this.settingsSwitch.click()
    await this.workflowSwitch.click()
  }
}
