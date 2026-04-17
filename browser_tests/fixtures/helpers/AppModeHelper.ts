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
  /** The "Switch to Outputs" button inside the connect-output popover. */
  public readonly connectOutputSwitchButton: Locator
  /** The empty-workflow dialog shown when entering builder on an empty graph. */
  public readonly emptyWorkflowDialog: Locator
  /** "Back to workflow" button on the empty-workflow dialog. */
  public readonly emptyWorkflowBackButton: Locator
  /** "Load template" button on the empty-workflow dialog. */
  public readonly emptyWorkflowLoadTemplateButton: Locator
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
  /** Arrange-step placeholder shown when outputs are configured but no run has happened. */
  public readonly arrangePreview: Locator
  /** Arrange-step state shown when no outputs have been configured. */
  public readonly arrangeNoOutputs: Locator
  /** "Switch to Outputs" button inside the arrange no-outputs state. */
  public readonly arrangeSwitchToOutputsButton: Locator
  /** The Vue Node switch notification popup shown on entering builder. */
  public readonly vueNodeSwitchPopup: Locator
  /** The "Dismiss" button inside the Vue Node switch popup. */
  public readonly vueNodeSwitchDismissButton: Locator
  /** The "Don't show again" checkbox inside the Vue Node switch popup. */
  public readonly vueNodeSwitchDontShowAgainCheckbox: Locator

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
    this.connectOutputSwitchButton = this.page.getByTestId(
      TestIds.builder.connectOutputSwitch
    )
    this.emptyWorkflowDialog = this.page.getByTestId(
      TestIds.builder.emptyWorkflowDialog
    )
    this.emptyWorkflowBackButton = this.page.getByTestId(
      TestIds.builder.emptyWorkflowBack
    )
    this.emptyWorkflowLoadTemplateButton = this.page.getByTestId(
      TestIds.builder.emptyWorkflowLoadTemplate
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
    this.arrangePreview = this.page.getByTestId(TestIds.appMode.arrangePreview)
    this.arrangeNoOutputs = this.page.getByTestId(
      TestIds.appMode.arrangeNoOutputs
    )
    this.arrangeSwitchToOutputsButton = this.page.getByTestId(
      TestIds.appMode.arrangeSwitchToOutputs
    )
    this.vueNodeSwitchPopup = this.page.getByTestId(
      TestIds.appMode.vueNodeSwitchPopup
    )
    this.vueNodeSwitchDismissButton = this.page.getByTestId(
      TestIds.appMode.vueNodeSwitchDismiss
    )
    this.vueNodeSwitchDontShowAgainCheckbox = this.page.getByTestId(
      TestIds.appMode.vueNodeSwitchDontShowAgain
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

  /** Set preference so the Vue node switch popup does not appear in builder. */
  async suppressVueNodeSwitchPopup() {
    await this.comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      true
    )
  }

  /** Allow the Vue node switch popup so tests can assert its behavior. */
  async allowVueNodeSwitchPopup() {
    await this.comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      false
    )
  }

  /** Enter builder mode via the "Workflow actions" dropdown. */
  async enterBuilder() {
    // Wait for any workflow-tab popover to dismiss before clicking —
    // the popover overlay can intercept the "Workflow actions" click.
    // Best-effort: the popover may or may not exist; if it stays visible
    // past the timeout we still proceed with the click.
    await this.page
      .locator('.workflow-popover-fade')
      .waitFor({ state: 'hidden', timeout: 5000 })
      .catch(() => {})

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
