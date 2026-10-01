import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import frMessages from '@/locales/fr/main.json' with { type: 'json' }

import type { AgentAdmissionDenialMock } from '@e2e/fixtures/data/agent/agentAdmissionDenials'

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
  public readonly attachmentChips: Locator
  public readonly composer: Locator
  public readonly composerPromptArea: Locator
  public readonly sendButton: Locator
  public readonly stopButton: Locator
  public readonly creditsExhaustedPaywall: Locator
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
    this.workflowPicker = this.root.getByRole('button', {
      name: enMessages.agent.switchWorkflow
    })
    this.fileInput = this.root.getByTestId('agent-file-input')
    this.composerAssetSection = this.root.getByTestId('composer-asset-section')
    this.attachmentChips = this.root.getByTestId('agent-attachment-chip')
    this.composer = this.root.getByRole('textbox', { name: /^Describe ideas/ })
    this.composerPromptArea = this.root.getByTestId('composer-inline-input')
    this.sendButton = this.root.getByRole('button', {
      name: enMessages.agent.send
    })
    this.stopButton = this.root.getByRole('button', {
      name: enMessages.agent.stop
    })
    this.creditsExhaustedPaywall = this.root.getByRole('alert').filter({
      hasText: enMessages.agent.paywall.title
    })
    this.nodeSelectionBanner = page.getByTestId('node-selection-mode-banner')
    this.activityRows = this.root.getByRole('listitem')
  }

  activityRow(label: string): Locator {
    return this.activityRows.getByText(label, { exact: true })
  }

  /**
   * The composer attachment carrying `name`. Matches on the chip's own
   * attribute rather than its text, which truncates at `max-w-32`.
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

  async selectWorkflow(name: string = 'Unsaved Workflow'): Promise<void> {
    await this.workflowPicker.click()
    await this.page.getByRole('menuitemradio', { name, exact: true }).click()
    await expect(this.workflowPicker).toHaveText(name)
  }

  async rejectNextTurn({
    status,
    body,
    retryAfterSeconds
  }: AgentAdmissionDenialMock): Promise<void> {
    let rejected = false
    // Scoped to POST so the agent fixture's GET handler still serves history.
    await this.page.route('**/api/agent/threads/*/messages', async (route) => {
      if (route.request().method() !== 'POST' || rejected) {
        return route.fallback()
      }
      rejected = true
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Retry-After': String(retryAfterSeconds) },
        body: JSON.stringify(body)
      })
    })
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
