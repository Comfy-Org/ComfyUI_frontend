import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { AgentAdmissionDenialMock } from '@e2e/fixtures/data/agent/agentAdmissionDenials'

export class AgentPanel {
  public readonly root: Locator
  public readonly openButton: Locator
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
  public readonly sendButton: Locator
  public readonly nodeSelectionBanner: Locator

  constructor(private readonly page: Page) {
    this.root = page.locator('#agent-panel-root')
    this.openButton = page.getByRole('button', {
      name: enMessages.agent.entryButton,
      exact: true
    })
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
    this.sendButton = this.root.getByRole('button', {
      name: enMessages.agent.send
    })
    this.nodeSelectionBanner = page.getByTestId('node-selection-mode-banner')
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

  async open(): Promise<void> {
    await this.openButton.click()
    await expect(this.root).toBeVisible()
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
