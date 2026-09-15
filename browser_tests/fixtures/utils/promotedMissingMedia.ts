import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { setPromotedHostWidgetValue } from '@e2e/fixtures/utils/promotedWidgets'
import type { NodeId } from '@/types/nodeId'

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

export async function setPromotedMediaHostOptionsAndValue(
  comfyPage: ComfyPage,
  hostNodeId: NodeId,
  leafNodeId: NodeId,
  hostWidgetName: string,
  leafWidgetName: string,
  value: string
) {
  await comfyPage.page.evaluate(
    ({ hostNodeId, hostWidgetName, value }) => {
      const host = window.app!.graph.getNodeById(hostNodeId)
      if (!host?.isSubgraphNode()) {
        throw new Error(`Expected subgraph host ${hostNodeId}`)
      }
      const hostWidget = host.widgets.find(
        (widget) => widget.name === hostWidgetName
      )
      if (!hostWidget) {
        throw new Error('Expected promoted host image widget')
      }

      const hostValues = hostWidget.options.values
      if (!Array.isArray(hostValues)) {
        throw new Error('Expected promoted host combo options')
      }
      hostWidget.options.values = [...hostValues, value]
    },
    { hostNodeId, hostWidgetName, value }
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
        throw new Error('Expected promoted leaf image widget')
      }
      const leafValues = leafWidget.options.values
      return Array.isArray(leafValues) && leafValues.includes(value)
    },
    { hostNodeId, leafNodeId, leafWidgetName, value }
  )
  return { hostValue, leafIncludesValue }
}
