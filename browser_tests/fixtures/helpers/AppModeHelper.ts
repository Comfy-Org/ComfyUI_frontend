import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'
import { TestIds } from '../selectors'

export class AppModeHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  private get builderToolbar(): Locator {
    return this.page.getByRole('navigation', { name: 'App Builder' })
  }

  /** Enter builder mode via the "Workflow actions" dropdown → "Build app". */
  async enterBuilder() {
    await this.page
      .getByRole('button', { name: 'Workflow actions' })
      .first()
      .click()
    await this.page.getByRole('menuitem', { name: 'Build app' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Exit builder mode via the footer "Exit app builder" button. */
  async exitBuilder() {
    await this.page.getByRole('button', { name: 'Exit app builder' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Inputs" step in the builder toolbar. */
  async goToInputs() {
    await this.builderToolbar.getByRole('button', { name: 'Inputs' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Outputs" step in the builder toolbar. */
  async goToOutputs() {
    await this.builderToolbar.getByRole('button', { name: 'Outputs' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Preview" step in the builder toolbar. */
  async goToPreview() {
    await this.builderToolbar.getByRole('button', { name: 'Preview' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Next" button in the builder footer. */
  async next() {
    await this.page.getByRole('button', { name: 'Next' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Click the "Back" button in the builder footer. */
  async back() {
    await this.page.getByRole('button', { name: 'Back' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Toggle app mode (linear view) on/off. */
  async toggleAppMode() {
    await this.page.evaluate(() => {
      window.app!.extensionManager.command.execute('Comfy.ToggleLinear')
    })
    await this.comfyPage.nextFrame()
  }

  /** Set up inputs/outputs on the graph and enter app mode. */
  async enterAppModeWithInputs(inputs: [string, string][]) {
    await this.page.evaluate(async (inputTuples) => {
      const graph = window.app!.graph
      if (!graph) return

      const outputNodeIds = graph.nodes
        .filter(
          (n: { type?: string }) =>
            n.type === 'SaveImage' || n.type === 'PreviewImage'
        )
        .map((n: { id: number | string }) => String(n.id))

      const workflow = graph.serialize() as unknown as Record<string, unknown>
      const extra = (workflow.extra ?? {}) as Record<string, unknown>
      extra.linearData = { inputs: inputTuples, outputs: outputNodeIds }
      workflow.extra = extra
      await window.app!.loadGraphData(
        workflow as unknown as Parameters<
          NonNullable<typeof window.app>['loadGraphData']
        >[0]
      )
    }, inputs)
    await this.comfyPage.nextFrame()
    await this.toggleAppMode()
  }

  /** The linear-mode widget list container (visible in app mode). */
  get linearWidgets(): Locator {
    return this.page.locator('[data-testid="linear-widgets"]')
  }

  /**
   * Get the actions menu trigger for a widget in the app mode widget list.
   * @param widgetName Text shown in the widget label (e.g. "seed").
   */
  getAppModeWidgetMenu(widgetName: string): Locator {
    // In the zone-based layout, widgets render inside NodeWidgets within zones.
    // Fall back to searching the entire linear-widgets container by text.
    return this.linearWidgets
      .locator(`[aria-label*="${widgetName}"]`)
      .getByTestId(TestIds.builder.widgetActionsMenu)
      .first()
      .or(
        this.linearWidgets
          .locator(`div:has(> div > span:text-is("${widgetName}"))`)
          .getByTestId(TestIds.builder.widgetActionsMenu)
          .first()
      )
  }

  /**
   * Get the actions menu trigger for a widget in the builder input-select
   * sidebar (IoItem).
   * @param title The widget title shown in the IoItem.
   */
  getBuilderInputItemMenu(title: string): Locator {
    return this.page
      .getByTestId(TestIds.builder.ioItem)
      .filter({ hasText: title })
      .getByTestId(TestIds.builder.widgetActionsMenu)
  }

  /**
   * Get the actions menu trigger for a widget in the builder preview/arrange
   * sidebar (AppModeWidgetList with builderMode).
   * @param ariaLabel The aria-label on the widget row, e.g. "seed — KSampler".
   */
  getBuilderPreviewWidgetMenu(ariaLabel: string): Locator {
    return this.page
      .locator(`[aria-label="${ariaLabel}"]`)
      .getByTestId(TestIds.builder.widgetActionsMenu)
  }

  /**
   * Rename a widget by clicking its popover trigger, selecting "Rename",
   * and filling in the dialog.
   * @param popoverTrigger The button that opens the widget's actions popover.
   * @param newName The new name to assign.
   */
  async renameWidget(popoverTrigger: Locator, newName: string) {
    await popoverTrigger.click()
    await this.page.getByText('Rename', { exact: true }).click()

    const dialogInput = this.page.locator(
      '.p-dialog-content input[type="text"]'
    )
    await dialogInput.fill(newName)
    await this.page.keyboard.press('Enter')
    await dialogInput.waitFor({ state: 'hidden' })
    await this.comfyPage.nextFrame()
  }
}
