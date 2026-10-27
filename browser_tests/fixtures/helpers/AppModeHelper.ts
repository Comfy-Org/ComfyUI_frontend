import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

import { OutputHistoryComponent } from '@e2e/fixtures/components/OutputHistory'
import { WorkflowActionsDropdown } from '@e2e/fixtures/components/WorkflowActionsDropdown'
import { AppModeWidgetHelper } from '@e2e/fixtures/helpers/AppModeWidgetHelper'
import { BuilderFooterHelper } from '@e2e/fixtures/helpers/BuilderFooterHelper'
import { BuilderSaveAsHelper } from '@e2e/fixtures/helpers/BuilderSaveAsHelper'
import { BuilderSelectHelper } from '@e2e/fixtures/helpers/BuilderSelectHelper'
import { BuilderStepsHelper } from '@e2e/fixtures/helpers/BuilderStepsHelper'
import { MobileAppHelper } from '@e2e/fixtures/helpers/MobileAppHelper'

export class AppModeHelper {
  readonly arrangeNoOutputs: Locator
  readonly arrangePreview: Locator
  readonly arrangeSwitchToOutputsButton: Locator
  readonly backToWorkflowButton: Locator
  readonly buildAppButton: Locator
  readonly cancelRunButton: Locator
  readonly centerPanel: Locator
  readonly connectOutputPopover: Locator
  readonly connectOutputSwitchButton: Locator
  readonly emptyWorkflowBackButton: Locator
  readonly emptyWorkflowDialog: Locator
  readonly emptyWorkflowLoadTemplateButton: Locator
  readonly emptyWorkflowText: Locator
  readonly footer: BuilderFooterHelper
  readonly imagePickerPopover: Locator
  readonly linearWidgets: Locator
  readonly loadTemplateButton: Locator
  readonly mobile: MobileAppHelper
  readonly outputHistory: OutputHistoryComponent
  readonly outputPlaceholder: Locator
  readonly rightPanelResizeHandle: Locator
  readonly runButton: Locator
  readonly saveAs: BuilderSaveAsHelper
  readonly select: BuilderSelectHelper
  readonly steps: BuilderStepsHelper
  readonly validationWarning: Locator
  readonly viewErrorsInGraphButton: Locator
  readonly vueNodeSwitchDismissButton: Locator
  readonly vueNodeSwitchDontShowAgainCheckbox: Locator
  readonly vueNodeSwitchPopup: Locator
  readonly welcome: Locator
  readonly widgets: AppModeWidgetHelper
  readonly workflowActions: WorkflowActionsDropdown

  constructor(private readonly comfyPage: ComfyPage) {
    this.mobile = new MobileAppHelper(comfyPage)
    this.footer = new BuilderFooterHelper(comfyPage)
    this.saveAs = new BuilderSaveAsHelper(comfyPage)
    this.select = new BuilderSelectHelper(comfyPage)
    this.outputHistory = new OutputHistoryComponent(comfyPage.page)
    this.steps = new BuilderStepsHelper(comfyPage)
    this.widgets = new AppModeWidgetHelper(comfyPage)
    this.workflowActions = new WorkflowActionsDropdown(comfyPage.page)

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
    this.linearWidgets = this.page.getByTestId(TestIds.linear.widgetContainer)
    this.validationWarning = this.page.getByTestId(
      TestIds.linear.validationWarning
    )
    this.viewErrorsInGraphButton = this.validationWarning.getByTestId(
      TestIds.linear.viewErrorsInGraph
    )
    this.imagePickerPopover = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('button', { name: 'All' }) })
      .first()
    this.runButton = this.page
      .getByTestId(TestIds.linear.runButton)
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
    this.centerPanel = this.page.getByTestId(TestIds.linear.centerPanel)
    this.rightPanelResizeHandle = this.page
      .getByRole('separator')
      .and(this.page.locator('[aria-controls="linearCenterPanel"]'))
  }

  private get page(): Page {
    return this.comfyPage.page
  }

  async resizeRightPanelBy(deltaX: number): Promise<void> {
    const box = await this.rightPanelResizeHandle.boundingBox()
    if (!box)
      throw new Error('App mode right panel resize handle has no layout')

    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await this.page.mouse.move(x, y)
    await this.page.mouse.down()
    await this.page.mouse.move(x + deltaX, y, { steps: 10 })
    await this.page.mouse.up()
  }

  async enableLinearMode() {
    await this.page.evaluate(() => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        linear_toggle_enabled: true
      }
    })
  }

  async enterBuilder() {
    await this.comfyPage.menu.topbar.dismissWorkflowPopover()

    await this.workflowActions.trigger.click()
    await this.page
      .getByRole('menuitem', { name: /Build app|Edit app/ })
      .click()
    await this.comfyPage.nextFrame()
  }

  async toggleAppMode() {
    await this.comfyPage.workflow.waitForActiveWorkflow()
    await this.comfyPage.command.executeCommand('Comfy.ToggleLinear')
  }

  async enterAppModeWithInputs(inputs: [string, string][]) {
    await this.page.evaluate(async (inputTuples) => {
      const graph = window.app!.graph

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

  getAppModeWidgetMenu(widgetName: string): Locator {
    return this.linearWidgets
      .locator(`div:has(> div > span:text-is("${widgetName}"))`)
      .getByTestId(TestIds.builder.widgetActionsMenu)
      .first()
  }
}
