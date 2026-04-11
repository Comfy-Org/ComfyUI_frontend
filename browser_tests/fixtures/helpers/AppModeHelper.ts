import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

import { OutputHistoryComponent } from '@e2e/fixtures/components/OutputHistory'
import { AppModeWidgetHelper } from '@e2e/fixtures/helpers/AppModeWidgetHelper'
import { BuilderFooterHelper } from '@e2e/fixtures/helpers/BuilderFooterHelper'
import { BuilderSaveAsHelper } from '@e2e/fixtures/helpers/BuilderSaveAsHelper'
import { BuilderSelectHelper } from '@e2e/fixtures/helpers/BuilderSelectHelper'
import { BuilderStepsHelper } from '@e2e/fixtures/helpers/BuilderStepsHelper'

export class AppModeHelper {
  readonly steps: BuilderStepsHelper
  readonly footer: BuilderFooterHelper
  readonly saveAs: BuilderSaveAsHelper
  readonly select: BuilderSelectHelper
  readonly outputHistory: OutputHistoryComponent
  readonly widgets: AppModeWidgetHelper
  /** The "Connect an output" popover shown when saving without outputs. */
  public readonly connectOutputPopover: Locator
  /** The empty-state placeholder shown when no outputs are selected. */
  public readonly outputPlaceholder: Locator
  /** The linear-mode widget list container (visible in app mode). */
  public readonly linearWidgets: Locator
  /** The PrimeVue Popover for the image picker (renders with role="dialog"). */
  public readonly imagePickerPopover: Locator
  /** The Run button in the app mode footer. */
  public readonly runButton: Locator
  /** The welcome screen shown when app mode has no outputs or no nodes. */
  public readonly welcome: Locator
  /** The empty workflow message shown when no nodes exist. */
  public readonly emptyWorkflowText: Locator
  /** The "Build app" button shown when nodes exist but no outputs. */
  public readonly buildAppButton: Locator
  /** The "Back to workflow" button on the welcome screen. */
  public readonly backToWorkflowButton: Locator
  /** The "Load template" button shown when no nodes exist. */
  public readonly loadTemplateButton: Locator
  /** The cancel button for an in-progress run in the output history. */
  public readonly cancelRunButton: Locator

  constructor(private readonly comfyPage: ComfyPage) {
    this.steps = new BuilderStepsHelper(comfyPage)
    this.footer = new BuilderFooterHelper(comfyPage)
    this.saveAs = new BuilderSaveAsHelper(comfyPage)
    this.select = new BuilderSelectHelper(comfyPage)
    this.outputHistory = new OutputHistoryComponent(comfyPage.page)
    this.widgets = new AppModeWidgetHelper(comfyPage)
    this.connectOutputPopover = this.page.getByTestId(
      TestIds.builder.connectOutputPopover
    )
    this.outputPlaceholder = this.page.getByTestId(
      TestIds.builder.outputPlaceholder
    )
    this.linearWidgets = this.page.getByTestId('linear-widgets')
    this.imagePickerPopover = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('button', { name: 'All' }) })
      .first()
    this.runButton = this.page
      .getByTestId('linear-run-button')
      .getByRole('button', { name: /run/i })
    this.welcome = this.page.getByTestId(TestIds.appMode.welcome)
    this.emptyWorkflowText = this.page.getByTestId(
      TestIds.appMode.emptyWorkflow
    )
    this.buildAppButton = this.page.getByTestId(TestIds.appMode.buildApp)
    this.backToWorkflowButton = this.page.getByTestId(
      TestIds.appMode.backToWorkflow
    )
    this.loadTemplateButton = this.page.getByTestId(
      TestIds.appMode.loadTemplate
    )
    this.cancelRunButton = this.page.getByTestId(
      TestIds.outputHistory.cancelRun
    )
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

  /** Enter builder mode via the "Workflow actions" dropdown. */
  async enterBuilder() {
    await this.page.keyboard.press('Escape')
    await this.comfyPage.nextFrame()
    await this.page
      .getByRole('button', { name: 'Workflow actions' })
      .first()
      .click()
    await this.page
      .getByRole('menuitem', { name: /Build app|Edit app/ })
      .click()
    await this.comfyPage.nextFrame()
  }

  /** Toggle app mode (linear view) on/off. */
  async toggleAppMode() {
    await this.comfyPage.workflow.waitForActiveWorkflow()
    await this.comfyPage.command.executeCommand('Comfy.ToggleLinear')
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
