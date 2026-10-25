import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { escapeRegExp } from 'es-toolkit'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import frMessages from '@/locales/fr/main.json' with { type: 'json' }

import type { AgentAdmissionDenialMock } from '@e2e/fixtures/data/agent/agentAdmissionDenials'
import { waitForCanvasViewToSettle } from '@e2e/fixtures/helpers/CanvasHelper'
import type { DragDropHelper } from '@e2e/fixtures/helpers/DragDropHelper'
import { ToastHelper } from '@e2e/fixtures/helpers/ToastHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

type AgentAttachmentOutcome =
  | 'attached'
  | 'refused'
  | 'workflowError'
  | 'ignored'

const HAND_OVER_TIMEOUT = 5_000

export class AgentPanel {
  public readonly activityRows: Locator
  public readonly attachmentChips: Locator
  public readonly closeButton: Locator
  public readonly composer: Locator
  public readonly composerAssetSection: Locator
  public readonly composerPromptArea: Locator
  public readonly composerStack: Locator
  public readonly consentDialog: Locator
  public readonly consentRejectButton: Locator
  public readonly copiedButton: Locator
  public readonly copyReportButton: Locator
  public readonly creditsExhaustedPaywall: Locator
  public readonly creditTransitionNotice: Locator
  public readonly debugHeading: Locator
  public readonly dockedPanel: Locator
  public readonly dockedPanelShell: Locator
  public readonly fileInput: Locator
  public readonly historyButton: Locator
  public readonly loadFailedMessage: Locator
  public readonly loadRetryButton: Locator
  public readonly nodeSelectionBanner: Locator
  public readonly openButton: Locator
  public readonly resizeHandle: Locator
  public readonly root: Locator
  public readonly scrollAssetsRight: Locator
  public readonly sendButton: Locator
  public readonly serverLogsSwitch: Locator
  public readonly settingsSwitch: Locator
  public readonly stopButton: Locator
  public readonly suggestedPrompts: Locator
  public readonly userMessageBubbles: Locator
  private readonly toasts: ToastHelper
  public readonly workflowPicker: Locator
  public readonly workflowSwitch: Locator
  public readonly workSummary: Locator

  constructor(private readonly page: Page) {
    this.root = page.locator('#agent-panel-root')
    this.toasts = new ToastHelper(page)
    this.activityRows = this.root
      .getByTestId(TestIds.agent.activityTrace)
      .getByRole('listitem')
    this.attachmentChips = this.root.getByTestId('agent-attachment-chip')
    this.closeButton = this.root
      .locator('header')
      .getByRole('button', { name: enMessages.g.close, exact: true })
      .or(
        this.root.locator('header').getByRole('button', {
          name: frMessages.g.close,
          exact: true
        })
      )
    this.composer = this.root.getByRole('textbox', {
      name: AGENT_COMPOSER_LABEL
    })
    this.composerStack = this.root.getByTestId('agent-composer-stack')
    this.composerAssetSection = this.root.getByTestId('composer-asset-section')
    this.composerPromptArea = this.root.getByTestId('composer-inline-input')
    this.consentDialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })
    this.consentRejectButton = this.consentDialog.getByRole('button', {
      name: enMessages.agent.consent.reject
    })
    this.copiedButton = this.root.getByRole('button', { name: 'Copied' })
    this.copyReportButton = this.root.getByRole('button', {
      name: 'Copy full report'
    })
    this.creditsExhaustedPaywall = this.root.getByRole('alert').filter({
      hasText: enMessages.agent.paywall.title
    })
    this.creditTransitionNotice = this.root.getByTestId(
      'agent-credit-transition-notice'
    )
    this.debugHeading = this.root.getByText('CRDT debug', { exact: true })
    this.dockedPanel = page.getByTestId('docked-agent-panel')
    this.dockedPanelShell = page.getByTestId('docked-agent-panel-shell')
    this.fileInput = this.root.getByTestId('agent-file-input')
    this.historyButton = this.root.getByRole('button', {
      name: enMessages.agent.showChatHistory
    })
    this.loadFailedMessage = this.dockedPanelShell.getByText(
      enMessages.agent.loadFailed
    )
    this.loadRetryButton = this.dockedPanelShell.getByRole('button', {
      name: enMessages.g.retry
    })
    this.nodeSelectionBanner = page.getByTestId('node-selection-mode-banner')
    this.openButton = page.getByRole('button', {
      name: enMessages.agent.entryButton,
      exact: true
    })
    this.resizeHandle = page.getByTestId('agent-panel-resize-handle')
    this.scrollAssetsRight = this.root.getByRole('button', {
      name: enMessages.g.scrollRight
    })
    this.sendButton = this.root.getByRole('button', {
      name: enMessages.agent.send
    })
    this.serverLogsSwitch = this.root.getByRole('switch', {
      name: 'Server logs'
    })
    this.settingsSwitch = this.root.getByRole('switch', { name: 'Settings' })
    this.stopButton = this.root.getByRole('button', {
      name: enMessages.agent.stop,
      exact: true
    })
    this.suggestedPrompts = this.root
      .getByTestId('suggested-prompts')
      .getByRole('button', { includeHidden: true })
    this.userMessageBubbles = this.root.getByTestId('user-message-bubble')
    this.workflowPicker = this.root.getByRole('button', {
      name: enMessages.agent.switchWorkflow
    })
    this.workflowSwitch = this.root.getByRole('switch', {
      name: 'Workflow JSON'
    })
    this.workSummary = this.root.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(enMessages.agent.worked)}`)
    })
  }

  async openChatFromHistory(title: string): Promise<void> {
    await this.historyButton.click()
    const row = this.root.getByRole('button', { name: title, exact: true })
    await expect(row).toBeEnabled()
    await row.click()
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

  private async dropOptions() {
    const box = await this.root.boundingBox()
    if (!box) throw new Error('Agent panel is not visible')
    return {
      preserveNativePropagation: true,
      dropPosition: { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }
  }

  async dropFile(dragDrop: DragDropHelper, fileName: string): Promise<void> {
    await dragDrop.dragAndDropFile(fileName, await this.dropOptions())
  }

  async dropGeneratedFile(
    dragDrop: DragDropHelper,
    generatedFile: { name: string; type: string; byteLength: number }
  ): Promise<void> {
    await dragDrop.dragAndDropGeneratedFile(
      generatedFile,
      await this.dropOptions()
    )
  }

  async handOverAttachment(
    fileName: string,
    route: () => Promise<void>
  ): Promise<AgentAttachmentOutcome> {
    await route()
    const toastReading = (messages: string[]): Locator =>
      this.toasts.withText(new RegExp(messages.map(escapeRegExp).join('|')))
    const attachmentRefusals = [
      enMessages.agent.attachmentTooLarge
        .replace('{name}', fileName)
        .split('{limit}')[0]
        .trimEnd(),
      enMessages.agent.attachmentUploadFailed.replace('{name}', fileName)
    ]

    return await Promise.any([
      this.attachmentChip(fileName)
        .waitFor({ state: 'visible', timeout: HAND_OVER_TIMEOUT })
        .then(() => 'attached' as const),
      toastReading(attachmentRefusals)
        .first()
        .waitFor({ state: 'visible', timeout: HAND_OVER_TIMEOUT })
        .then(() => 'refused' as const),
      toastReading([
        enMessages.toastMessages.fileLoadError.replace('{fileName}', fileName)
      ])
        .first()
        .waitFor({ state: 'visible', timeout: HAND_OVER_TIMEOUT })
        .then(() => 'workflowError' as const)
    ]).catch(() => 'ignored' as const)
  }

  async removeAllAttachments(): Promise<void> {
    const removeName = new RegExp(
      `^${escapeRegExp(enMessages.agent.removeAsset.replace('{name}', ''))}`
    )
    for (let count = await this.attachmentChips.count(); count > 0; count--) {
      const chip = this.attachmentChips.first()
      await chip.hover()
      await chip.getByRole('button', { name: removeName }).click()
      await expect(this.attachmentChips).toHaveCount(count - 1)
    }
    await this.toasts.closeToasts()
  }

  async open(timeout?: number): Promise<Locator> {
    return this.openUntilVisible(this.root, timeout)
  }

  /** Opens the panel until its dock is on screen, whatever the dock draws. */
  async openDock(timeout?: number): Promise<Locator> {
    return this.openUntilVisible(this.dockedPanel, timeout)
  }

  private async openUntilVisible(
    target: Locator,
    timeout?: number
  ): Promise<Locator> {
    if (await target.isVisible()) return target

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
        if (await target.isVisible()) return
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

    await expect(target).toBeVisible({ timeout })
    return target
  }

  async close(): Promise<void> {
    await this.closeButton.click()
    await expect(this.root).toHaveCount(0)
  }

  /**
   * Drags the resize handle until `target` is exactly `width` wide.
   *
   * Defaults to the panel root, the element the Agent container queries resolve
   * against, so a breakpoint test measures what the CSS measures. Pass
   * `dockedPanel` to size the outer dock the user drags instead.
   */
  async resizeTo(width: number, target: Locator = this.root): Promise<void> {
    const [panelBox, handleBox] = await Promise.all([
      target.boundingBox(),
      this.resizeHandle.boundingBox()
    ])
    if (!panelBox || !handleBox) {
      throw new Error('Agent panel and resize handle must be visible')
    }

    const handleCenterX = handleBox.x + handleBox.width / 2
    const handleY = handleBox.y + 20
    await this.page.mouse.move(handleCenterX, handleY)
    await this.page.mouse.down()
    await this.page.mouse.move(
      handleCenterX - (width - panelBox.width),
      handleY
    )
    await this.page.mouse.up()
    await expect(target).toHaveCSS('width', `${width}px`)
  }

  async suggestedPromptVisibility(): Promise<boolean[]> {
    return this.suggestedPrompts.evaluateAll((buttons) =>
      buttons.map((button) => getComputedStyle(button).display !== 'none')
    )
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
    await this.page.mouse.move(0, 0)
    await this.workflowPicker.blur()
    await expect(
      this.page.getByRole('tooltip').filter({ visible: true })
    ).toHaveCount(0)
  }

  /** Denies every turn POST with this admission denial for the rest of the test. */
  async rejectEveryTurn({
    status,
    body,
    retryAfterSeconds
  }: AgentAdmissionDenialMock): Promise<void> {
    // Scoped to POST so the agent fixture's GET handler still serves history.
    await this.page.route('**/api/agent/threads/*/messages', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback()
      }
      await route.fulfill({
        ...jsonRoute(body),
        status,
        headers: { 'Retry-After': String(retryAfterSeconds) }
      })
    })
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

  async expectUserMessages(prompts: string[]): Promise<void> {
    await expect(this.userMessageBubbles).toHaveText(prompts)
  }

  async expectTurnSettled(): Promise<void> {
    await expect(
      this.stopButton,
      'the active turn must settle before another turn is composed'
    ).toHaveCount(0)
    await expect(this.composer).toHaveText('')
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
    await waitForCanvasViewToSettle(this.page)
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
