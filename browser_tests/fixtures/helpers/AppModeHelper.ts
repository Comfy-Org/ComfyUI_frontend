import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'
import { TestIds } from '../selectors'

import { BuilderFooterHelper } from './BuilderFooterHelper'
import { BuilderSaveAsHelper } from './BuilderSaveAsHelper'
import { BuilderSelectHelper } from './BuilderSelectHelper'
import { BuilderStepsHelper } from './BuilderStepsHelper'

export class AppModeHelper {
  readonly steps: BuilderStepsHelper
  readonly footer: BuilderFooterHelper
  readonly saveAs: BuilderSaveAsHelper
  readonly select: BuilderSelectHelper

  constructor(private readonly comfyPage: ComfyPage) {
    this.steps = new BuilderStepsHelper(comfyPage)
    this.footer = new BuilderFooterHelper(comfyPage)
    this.saveAs = new BuilderSaveAsHelper(comfyPage)
    this.select = new BuilderSelectHelper(comfyPage)
  }

  private get page(): Page {
    return this.comfyPage.page
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

  /** Toggle app mode (linear view) on/off. */
  async toggleAppMode() {
    await this.page.evaluate(() => {
      window.app!.extensionManager.command.execute('Comfy.ToggleLinear')
    })
    await this.comfyPage.nextFrame()
  }

  /**
   * Inject linearData into the current graph and enter app mode.
   *
   * Serializes the graph, injects linearData with the given inputs and
   * auto-detected output node IDs, then reloads so the appModeStore
   * picks up the data via its activeWorkflow watcher.
   *
   * @param inputs - Widget selections as [nodeId, widgetName] tuples
   */
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
    return this.linearWidgets
      .locator(`div:has(> div > span:text-is("${widgetName}"))`)
      .getByTestId(TestIds.builder.widgetActionsMenu)
      .first()
  }
}
