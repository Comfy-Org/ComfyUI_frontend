import { readFileSync } from 'fs'

import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

const PROMOTED_MODEL_WIDGET_NAME = 'ckpt_name'

interface PromotedMissingModelWorkflow {
  workflowName: string
  hostNodeId: number
  hostNodeTitle: string
  sharedDefinitionSiblingHostNodeId?: number
  sharedDefinitionSiblingHostNodeTitle?: string
}

type RootWorkflowNode = {
  id: number | string
  widgets_values?: unknown[] | Record<string, unknown>
}

type RootWorkflowData = ComfyWorkflowJSON & {
  nodes?: RootWorkflowNode[]
}

export const NESTED_PROMOTED_MISSING_MODEL_WORKFLOW: PromotedMissingModelWorkflow =
  {
    workflowName: 'missing/missing_model_nested_promoted_widget',
    hostNodeId: 4,
    hostNodeTitle: 'Outer Subgraph with Promoted Missing Model',
    sharedDefinitionSiblingHostNodeId: 3,
    sharedDefinitionSiblingHostNodeTitle: 'Resolved Shared Outer Subgraph'
  }

export function getMissingModelLabel(group: Locator, modelName: string) {
  return group.getByRole('button', { name: modelName, exact: true })
}

export async function expectSingleMissingModelReference(
  group: Locator,
  modelName: string
) {
  await expectMissingModelReferenceCount(group, modelName, 1)
}

export async function expectMissingModelReferenceCount(
  group: Locator,
  modelName: string,
  count: number
) {
  await expect(getMissingModelLabel(group, modelName)).toHaveCount(1)
  const badge = group.getByTestId(TestIds.dialogs.missingModelReferenceCount)
  if (count === 1) {
    await expect(badge).toBeHidden()
    return
  }
  await expect(badge).toBeVisible()
  await expect(badge).toHaveText(String(count))
}

export async function loadPromotedMissingModelAndOpenErrorsTab(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  modelName: string
): Promise<Locator> {
  await loadWorkflowAndOpenErrorsTab(comfyPage, workflow.workflowName)

  const missingModelGroup = comfyPage.page.getByTestId(
    TestIds.dialogs.missingModelsGroup
  )
  await expectSingleMissingModelReference(missingModelGroup, modelName)
  return missingModelGroup
}

export async function loadPromotedMissingModelWithHostValuesAndOpenErrorsTab(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  hostValues: Record<number, string>,
  modelName: string,
  expectedReferenceCount: number
): Promise<Locator> {
  await loadPromotedMissingModelWithHostValues(comfyPage, workflow, hostValues)

  const errorOverlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
  await expect(errorOverlay).toBeVisible()
  await errorOverlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()
  await expect(errorOverlay).toBeHidden()

  const missingModelGroup = comfyPage.page.getByTestId(
    TestIds.dialogs.missingModelsGroup
  )
  await expectMissingModelReferenceCount(
    missingModelGroup,
    modelName,
    expectedReferenceCount
  )
  return missingModelGroup
}

export async function expectNoMissingModelUi(comfyPage: ComfyPage) {
  const panel = new PropertiesPanelHelper(comfyPage.page)
  await expect(
    comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
  ).toBeHidden()
  await panel.open(comfyPage.actionbar.propertiesButton)
  await expect(
    panel.root.getByTestId(TestIds.propertiesPanel.errorsTab)
  ).toBeHidden()
  await expect(
    comfyPage.page.getByTestId(TestIds.dialogs.missingModelsGroup)
  ).toBeHidden()
}

export async function selectVueComboPromotedModelByTitle(
  comfyPage: ComfyPage,
  nodeTitle: string,
  modelName: string
) {
  await comfyPage.vueNodes.selectComboOption(
    nodeTitle,
    PROMOTED_MODEL_WIDGET_NAME,
    modelName
  )
}

export async function selectVueAssetPromotedModel(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  currentModelName: string,
  modelName: string
) {
  await selectModelFromFormDropdown(
    comfyPage,
    comfyPage.vueNodes.getNodeByTitle(workflow.hostNodeTitle),
    currentModelName,
    modelName
  )
}

export async function selectSectionComboPromotedModel(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  modelName: string
) {
  const panel = await openHostNodeParametersPanel(comfyPage, workflow)
  const combo = panel.contentArea.getByRole('combobox', {
    name: PROMOTED_MODEL_WIDGET_NAME,
    exact: true
  })
  await combo.click()
  await comfyPage.page
    .getByRole('option', { name: modelName, exact: true })
    .click()
}

export async function selectSectionAssetPromotedModel(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  currentModelName: string,
  modelName: string
) {
  const panel = await openHostNodeParametersPanel(comfyPage, workflow)
  await selectModelFromFormDropdown(
    comfyPage,
    panel.contentArea,
    currentModelName,
    modelName
  )
}

export async function setLegacyPromotedComboModel(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  modelName: string
) {
  await comfyPage.page.evaluate(
    ({ hostNodeId, widgetName, value }) => {
      type LegacyPromotedWidget = {
        name?: string
        value?: unknown
        callback?: (value: string) => void
        setValue?: (
          value: string,
          options: {
            e: PointerEvent
            node: unknown
            canvas: unknown
          }
        ) => void
      }
      type LegacyPromotedNode = {
        onWidgetChanged?: (
          name: string,
          newValue: string,
          oldValue: unknown,
          widget: LegacyPromotedWidget
        ) => void
        widgets?: LegacyPromotedWidget[]
      }
      type LegacyPromotedGraph = {
        getNodeById: (nodeId: number) => LegacyPromotedNode | undefined
      }

      const currentGraph = window.app?.graph as LegacyPromotedGraph | undefined
      const hostNode: LegacyPromotedNode | undefined =
        currentGraph?.getNodeById(hostNodeId)
      if (!hostNode) {
        throw new Error(`Expected subgraph host node ${hostNodeId}`)
      }

      const widget = hostNode.widgets?.find(
        (entry) => entry.name === widgetName
      ) as LegacyPromotedWidget | undefined
      if (!widget) {
        throw new Error(`Expected host ${widgetName} widget`)
      }

      const oldValue = widget.value
      if (widget.setValue) {
        widget.setValue(value, {
          e: new PointerEvent('pointerup'),
          node: hostNode,
          canvas: window.app!.canvas
        })
        return
      }

      widget.value = value
      widget.callback?.(value)
      hostNode.onWidgetChanged?.(
        widget.name ?? widgetName,
        value,
        oldValue,
        widget
      )
    },
    {
      hostNodeId: workflow.hostNodeId,
      widgetName: PROMOTED_MODEL_WIDGET_NAME,
      value: modelName
    }
  )
}

export async function selectLegacyPromotedAssetModel(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  assetId: string
) {
  await clickLegacyHostPromotedWidget(comfyPage, workflow)

  const modal = comfyPage.page.locator(
    '[data-component-id="AssetBrowserModal"]'
  )
  await expect(modal).toBeVisible()
  const assetCard = modal.locator(`[data-asset-id="${assetId}"]`)
  await expect(assetCard).toBeVisible()
  await assetCard.getByRole('button', { name: 'Use', exact: true }).click()
  await expect(modal).toBeHidden()
}

export async function expectResolvedPromotedModelSuppressesStaleInteriorErrors(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  expectedStaleInteriorWidgets: Array<{
    subgraphNodeIdToEnter: string
    nodeTitle: string
  }>,
  resolvedModelName: string,
  staleModelName: string
) {
  await loadPromotedMissingModelWithHostValues(comfyPage, workflow, {
    [workflow.hostNodeId]: resolvedModelName
  })

  const promotedModelCombo = comfyPage.vueNodes
    .getNodeByTitle(workflow.hostNodeTitle)
    .getByRole('combobox', { name: PROMOTED_MODEL_WIDGET_NAME, exact: true })
  await expect(promotedModelCombo).toContainText(resolvedModelName)
  await expectNoMissingModelUi(comfyPage)

  for (const step of expectedStaleInteriorWidgets) {
    await enterSubgraphForStaleInteriorCheck(
      comfyPage,
      step.subgraphNodeIdToEnter
    )
    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
    await comfyPage.nextFrame()

    const node = comfyPage.vueNodes.getNodeByTitle(step.nodeTitle)
    await expect(node).toBeVisible()

    const staleCombo = node.getByRole('combobox', {
      name: PROMOTED_MODEL_WIDGET_NAME,
      exact: true
    })
    await expect(
      staleCombo,
      `${step.nodeTitle} should expose the stale linked interior widget`
    ).toBeDisabled()
    await expect(
      staleCombo,
      `${step.nodeTitle} should keep the stale interior value`
    ).toContainText(staleModelName)
    await expectNoMissingModelUi(comfyPage)
  }
}

async function openHostNodeParametersPanel(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow
): Promise<PropertiesPanelHelper> {
  await comfyPage.vueNodes.selectNode(String(workflow.hostNodeId))
  const panel = new PropertiesPanelHelper(comfyPage.page)
  await panel.open(comfyPage.actionbar.propertiesButton)
  await expect(panel.getTab('Parameters')).toBeVisible()
  await panel.switchToTab('Parameters')
  return panel
}

async function loadPromotedMissingModelWithHostValues(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  hostValues: Record<number, string>
) {
  const graphData = readPromotedMissingModelWorkflow(workflow.workflowName)
  for (const [hostNodeId, value] of Object.entries(hostValues)) {
    setRootHostWidgetValue(graphData, Number(hostNodeId), value)
  }

  await comfyPage.workflow.loadGraphData(graphData)
  await comfyPage.vueNodes.waitForNodes()
}

function readPromotedMissingModelWorkflow(workflowName: string) {
  return JSON.parse(
    readFileSync(assetPath(`${workflowName}.json`), 'utf-8')
  ) as RootWorkflowData
}

function setRootHostWidgetValue(
  graphData: RootWorkflowData,
  hostNodeId: number,
  value: string
) {
  const hostNode = graphData.nodes?.find(
    (node) => Number(node.id) === hostNodeId
  )
  if (!hostNode) throw new Error(`Expected host node ${hostNodeId}`)

  if (Array.isArray(hostNode.widgets_values)) {
    hostNode.widgets_values[0] = value
    return
  }

  hostNode.widgets_values = {
    ...(hostNode.widgets_values ?? {}),
    [PROMOTED_MODEL_WIDGET_NAME]: value
  }
}

async function selectModelFromFormDropdown(
  comfyPage: ComfyPage,
  root: Locator,
  currentModelName: string,
  nextModelName: string
) {
  const trigger = root
    .getByRole('button', { name: currentModelName, exact: true })
    .first()
  await expect(trigger).toBeVisible()
  await trigger.click()

  const menu = comfyPage.page.getByTestId('form-dropdown-menu')
  await expect(menu).toBeVisible()
  await menu.getByText(nextModelName, { exact: true }).click()
  await expect(menu).toBeHidden()
}

async function clickLegacyHostPromotedWidget(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow
) {
  const hostNode = await comfyPage.nodeOps.getNodeRefById(workflow.hostNodeId)
  await hostNode.centerOnNode()
  const widget = await hostNode.getWidgetByName(PROMOTED_MODEL_WIDGET_NAME)
  await widget.click()
}

async function enterSubgraphForStaleInteriorCheck(
  comfyPage: ComfyPage,
  nodeId: string
) {
  const numericNodeId = Number(nodeId)
  if (Number.isNaN(numericNodeId)) {
    throw new Error(`Expected numeric subgraph node id, got ${nodeId}`)
  }

  const normalizedNodeId = String(numericNodeId)
  const enterButton =
    comfyPage.vueNodes.getSubgraphEnterButton(normalizedNodeId)
  if ((await enterButton.count()) > 0) {
    await comfyPage.vueNodes.enterSubgraph(normalizedNodeId)
    return
  }

  await comfyPage.page.evaluate((targetNodeId) => {
    const graph = window.app?.canvas.graph
    const node = graph?.getNodeById(targetNodeId)
    if (!node?.isSubgraphNode()) {
      throw new Error(`Expected visible subgraph node ${targetNodeId}`)
    }
    window.app!.canvas.setGraph(node.subgraph)
  }, toNodeId(normalizedNodeId))
  await comfyPage.nextFrame()
  await comfyPage.vueNodes.waitForNodes()
}
