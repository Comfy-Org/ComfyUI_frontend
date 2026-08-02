import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { setPromotedHostWidgetValue } from '@e2e/fixtures/utils/promotedWidgets'
import type { NodeId } from '@/types/nodeId'

/**
 * Selects an option in a promoted media widget identified by its node title and widget label.
 *
 * @param nodeTitle - The title of the Vue node containing the widget
 * @param widgetName - The widget label
 * @param optionName - The option to select
 */
export async function selectVuePromotedMediaByTitle(
  comfyPage: ComfyPage,
  nodeTitle: string,
  widgetName: string,
  optionName: string
) {
  const widgetRow = comfyPage.vueNodes.getWidgetRowByLabel(
    nodeTitle,
    widgetName
  )
  await expect(widgetRow).toHaveCount(1)

  const dropdown = new WidgetSelectDropdownFixture(widgetRow)
  await dropdown.selectOption(optionName)
  await expect(dropdown.selection).toHaveText(optionName)
}

/**
 * Sets a promoted media host widget value and checks whether the value is available in the corresponding leaf widget options.
 *
 * @param hostNodeId - The identifier of the subgraph host node
 * @param leafNodeId - The identifier of the leaf node within the host subgraph
 * @param hostWidgetName - The host widget name
 * @param leafWidgetName - The leaf widget name
 * @param value - The media value to add and select
 * @returns An object containing the resulting host value and whether the leaf widget options include the value
 */
export async function setPromotedMediaHostOptionsAndValue(
  comfyPage: ComfyPage,
  hostNodeId: NodeId,
  leafNodeId: NodeId,
  hostWidgetName: string,
  leafWidgetName: string,
  value: string
) {
  await comfyPage.page.evaluate(
    ({ hostNodeId, leafNodeId, hostWidgetName, leafWidgetName, value }) => {
      const host = window.app!.graph.getNodeById(hostNodeId)
      if (!host?.isSubgraphNode()) {
        throw new Error(`Expected subgraph host ${hostNodeId}`)
      }
      const hostWidget = host.widgets.find(
        (widget) => widget.name === hostWidgetName
      )
      const leafWidget = host.subgraph
        .getNodeById(leafNodeId)
        ?.widgets?.find((widget) => widget.name === leafWidgetName)
      if (!hostWidget || !leafWidget) {
        throw new Error('Expected promoted host and leaf image widgets')
      }

      const hostValues = hostWidget.options.values
      if (!Array.isArray(hostValues)) {
        throw new Error('Expected promoted host combo options')
      }
      hostWidget.options.values = [...hostValues, value]
    },
    { hostNodeId, leafNodeId, hostWidgetName, leafWidgetName, value }
  )
  const hostValue = await setPromotedHostWidgetValue(
    comfyPage,
    hostNodeId,
    hostWidgetName,
    value
  )
  const leafIncludesValue = await comfyPage.page.evaluate(
    ({ hostNodeId, leafNodeId, leafWidgetName, value }) => {
      const host = window.app!.graph.getNodeById(hostNodeId)
      if (!host?.isSubgraphNode()) {
        throw new Error(`Expected subgraph host ${hostNodeId}`)
      }
      const leafWidget = host.subgraph
        .getNodeById(leafNodeId)
        ?.widgets?.find((widget) => widget.name === leafWidgetName)
      if (!leafWidget) {
        throw new Error('Expected promoted host and leaf image widgets')
      }
      const leafValues = leafWidget.options.values
      return Array.isArray(leafValues) && leafValues.includes(value)
    },
    { hostNodeId, leafNodeId, leafWidgetName, value }
  )
  return { hostValue, leafIncludesValue }
}
