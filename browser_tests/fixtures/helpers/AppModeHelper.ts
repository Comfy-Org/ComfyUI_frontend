import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'
import { TestIds } from '../selectors'

import { AppModeWidgetHelper } from './AppModeWidgetHelper'
import { BuilderFooterHelper } from './BuilderFooterHelper'
import { BuilderSaveAsHelper } from './BuilderSaveAsHelper'
import { BuilderSelectHelper } from './BuilderSelectHelper'
import { BuilderStepsHelper } from './BuilderStepsHelper'

export class AppModeHelper {
  readonly steps: BuilderStepsHelper
  readonly footer: BuilderFooterHelper
  readonly saveAs: BuilderSaveAsHelper
  readonly select: BuilderSelectHelper
  readonly widgets: AppModeWidgetHelper

  constructor(private readonly comfyPage: ComfyPage) {
    this.steps = new BuilderStepsHelper(comfyPage)
    this.footer = new BuilderFooterHelper(comfyPage)
    this.saveAs = new BuilderSaveAsHelper(comfyPage)
    this.select = new BuilderSelectHelper(comfyPage)
    this.widgets = new AppModeWidgetHelper(comfyPage)
  }

  private get page(): Page {
    return this.comfyPage.page
  }

  /** Enable the linear mode feature flag and top menu. */
  async enableLinearMode() {
    await this.page.evaluate(() => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        linear_toggle_enabled: true
      }
    })
    await this.comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
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

  /** The PrimeVue Popover for the image picker (renders with role="dialog"). */
  get imagePickerPopover(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('button', { name: 'All' }) })
      .first()
  }

  /** The Run button in the app mode footer. */
  get runButton(): Locator {
    return this.page
      .getByTestId('linear-run-button')
      .getByRole('button', { name: /run/i })
  }

  /** The welcome screen shown when app mode has no outputs or no nodes. */
  get welcome(): Locator {
    return this.page.getByTestId(TestIds.appMode.welcome)
  }

  /** The empty workflow message shown when no nodes exist. */
  get emptyWorkflowText(): Locator {
    return this.page.getByTestId(TestIds.appMode.emptyWorkflow)
  }

  /** The "Build app" button shown when nodes exist but no outputs. */
  get buildAppButton(): Locator {
    return this.page.getByTestId(TestIds.appMode.buildApp)
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
