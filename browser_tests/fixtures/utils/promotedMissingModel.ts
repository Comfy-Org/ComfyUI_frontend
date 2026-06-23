import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const PROMOTED_MODEL_WIDGET_NAME = 'ckpt_name'

export interface PromotedMissingModelWorkflow {
  workflowName: string
  hostNodeId: number
  hostNodeTitle: string
  sourceNodePath: number[]
}

export interface ResolvedPromotedModelWorkflow {
  workflowName: string
  hostNodeTitle: string
  expectedStaleInteriorWidgets: Array<{
    subgraphNodeIdToEnter: string
    nodeTitle: string
  }>
}

type LegacyPromotedWidgetOperation =
  | { type: 'set-value'; value: string }
  | { type: 'open-asset-modal' }

export const PROMOTED_MISSING_MODEL_WORKFLOW: PromotedMissingModelWorkflow = {
  workflowName: 'missing/missing_model_promoted_widget',
  hostNodeId: 2,
  hostNodeTitle: 'Subgraph with Promoted Missing Model',
  sourceNodePath: [1]
}

export const NESTED_PROMOTED_MISSING_MODEL_WORKFLOW: PromotedMissingModelWorkflow =
  {
    workflowName: 'missing/missing_model_nested_promoted_widget',
    hostNodeId: 3,
    hostNodeTitle: 'Outer Subgraph with Promoted Missing Model',
    sourceNodePath: [2, 1]
  }

export function getMissingModelLabel(group: Locator, modelName: string) {
  return group.getByRole('button', { name: modelName, exact: true })
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
  await expect(getMissingModelLabel(missingModelGroup, modelName)).toBeVisible()
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

export async function selectVueComboPromotedModel(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  modelName: string
) {
  await comfyPage.vueNodes.selectComboOption(
    workflow.hostNodeTitle,
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
  await selectFormDropdownModel(
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
  const panel = await openHostParametersPanel(comfyPage, workflow)
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
  const panel = await openHostParametersPanel(comfyPage, workflow)
  await selectFormDropdownModel(
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
  await runLegacyPromotedWidgetOperation(comfyPage, workflow, {
    type: 'set-value',
    value: modelName
  })
}

export async function selectLegacyPromotedAssetModel(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  assetId: string
) {
  await expectLegacyPromotedWidgetType(comfyPage, workflow, 'asset')
  await runLegacyPromotedWidgetOperation(comfyPage, workflow, {
    type: 'open-asset-modal'
  })

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
  workflow: ResolvedPromotedModelWorkflow,
  resolvedModelName: string,
  staleModelName: string
) {
  await comfyPage.workflow.loadWorkflow(workflow.workflowName)

  const promotedModelCombo = comfyPage.vueNodes
    .getNodeByTitle(workflow.hostNodeTitle)
    .getByRole('combobox', { name: PROMOTED_MODEL_WIDGET_NAME, exact: true })
  await expect(promotedModelCombo).toContainText(resolvedModelName)
  await expectNoMissingModelUi(comfyPage)

  for (const step of workflow.expectedStaleInteriorWidgets) {
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

async function openHostParametersPanel(
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

async function selectFormDropdownModel(
  comfyPage: ComfyPage,
  root: Locator,
  currentModelName: string,
  modelName: string
) {
  const trigger = root
    .getByRole('button', { name: currentModelName, exact: true })
    .first()
  await expect(trigger).toBeVisible()
  await trigger.click()

  const menu = comfyPage.page.getByTestId('form-dropdown-menu')
  await expect(menu).toBeVisible()
  await menu.getByText(modelName, { exact: true }).click()
  await expect(menu).toBeHidden()
}

async function expectLegacyPromotedWidgetType(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  widgetType: string
) {
  await expect
    .poll(
      () =>
        comfyPage.page.evaluate(
          ({ hostNodeId, sourceNodePath, widgetName }) => {
            let currentGraph = window.app?.graph
            const hostNode = currentGraph?.getNodeById(hostNodeId)
            if (!hostNode?.isSubgraphNode()) return undefined

            currentGraph = hostNode.subgraph
            for (const nodeId of sourceNodePath.slice(0, -1)) {
              const node = currentGraph?.getNodeById(nodeId)
              if (!node?.isSubgraphNode()) return undefined
              currentGraph = node.subgraph
            }

            const sourceNodeId = sourceNodePath.at(-1)
            const sourceNode =
              sourceNodeId === undefined
                ? undefined
                : currentGraph?.getNodeById(sourceNodeId)
            return sourceNode?.widgets?.find(
              (widget) => widget.name === widgetName
            )?.type
          },
          {
            hostNodeId: workflow.hostNodeId,
            sourceNodePath: workflow.sourceNodePath,
            widgetName: PROMOTED_MODEL_WIDGET_NAME
          }
        ),
      { timeout: 10_000 }
    )
    .toBe(widgetType)
}

async function runLegacyPromotedWidgetOperation(
  comfyPage: ComfyPage,
  workflow: PromotedMissingModelWorkflow,
  operation: LegacyPromotedWidgetOperation
) {
  await comfyPage.page.evaluate(
    async ({ hostNodeId, sourceNodePath, widgetName, operation }) => {
      type LegacyPromotedWidget = {
        name?: string
        type?: string
        setValue?: (
          value: string,
          options: {
            e: PointerEvent
            node: unknown
            canvas: unknown
          }
        ) => void
        options?: {
          openModal?: (widget: LegacyPromotedWidget) => void | Promise<void>
        }
      }
      type LegacyPromotedNode = {
        isSubgraphNode?: () => boolean
        subgraph?: LegacyPromotedGraph
        widgets?: LegacyPromotedWidget[]
      }
      type LegacyPromotedGraph = {
        getNodeById: (nodeId: number) => LegacyPromotedNode | undefined
      }

      let currentGraph = window.app?.graph as LegacyPromotedGraph | undefined
      const hostNode: LegacyPromotedNode | undefined =
        currentGraph?.getNodeById(hostNodeId)
      if (!hostNode?.isSubgraphNode?.() || !hostNode.subgraph) {
        throw new Error(`Expected subgraph host node ${hostNodeId}`)
      }

      currentGraph = hostNode.subgraph
      for (const nodeId of sourceNodePath.slice(0, -1)) {
        const node: LegacyPromotedNode | undefined =
          currentGraph?.getNodeById(nodeId)
        if (!node?.isSubgraphNode?.() || !node.subgraph) {
          throw new Error(`Expected nested subgraph node ${nodeId}`)
        }
        currentGraph = node.subgraph
      }

      const sourceNodeId = sourceNodePath.at(-1)
      const sourceNode =
        sourceNodeId === undefined
          ? undefined
          : currentGraph?.getNodeById(sourceNodeId)
      const widget = sourceNode?.widgets?.find(
        (entry) => entry.name === widgetName
      ) as LegacyPromotedWidget | undefined
      if (!widget) {
        throw new Error(`Expected concrete ${widgetName} widget`)
      }

      if (operation.type === 'set-value') {
        if (!widget.setValue) {
          throw new Error(`Expected settable ${widgetName} widget`)
        }

        widget.setValue(operation.value, {
          e: new PointerEvent('pointerup'),
          node: hostNode,
          canvas: window.app!.canvas
        })
        return
      }

      const openModal = widget.options?.openModal
      if (widget.type !== 'asset' || !openModal) {
        throw new Error(`Expected asset ${widgetName} widget`)
      }
      await openModal(widget)
    },
    {
      hostNodeId: workflow.hostNodeId,
      sourceNodePath: workflow.sourceNodePath,
      widgetName: PROMOTED_MODEL_WIDGET_NAME,
      operation
    }
  )
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
  }, numericNodeId)
  await comfyPage.nextFrame()
  await comfyPage.vueNodes.waitForNodes()
}
