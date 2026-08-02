import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeId } from '@/types/nodeId'

export async function selectVuePromotedMediaByTitle(
  comfyPage: ComfyPage,
  nodeTitle: string,
  widgetName: string,
  optionName: string
) {
  const node = comfyPage.vueNodes.getNodeByTitle(nodeTitle)
  const widgetLabel = comfyPage.page
    .getByTestId(TestIds.widgets.layoutFieldLabel)
    .and(comfyPage.page.getByText(widgetName, { exact: true }))

  const widgetRow = node
    .getByTestId(TestIds.widgets.widget)
    .filter({ has: widgetLabel })
  await expect(widgetRow).toHaveCount(1)

  const dropdown = new WidgetSelectDropdownFixture(widgetRow)
  await dropdown.selectOption(optionName)
}

export async function setPromotedMediaHostOptionsAndValue(
  comfyPage: ComfyPage,
  hostNodeId: NodeId,
  leafNodeId: NodeId,
  hostWidgetName: string,
  leafWidgetName: string,
  value: string
) {
  return await comfyPage.page.evaluate(
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
      const oldValue = hostWidget.value
      hostWidget.value = value
      hostWidget.callback?.(value)
      host.onWidgetChanged?.call(
        host,
        hostWidget.name,
        value,
        oldValue,
        hostWidget
      )

      const leafValues = leafWidget.options.values
      return {
        hostValue: hostWidget.value,
        leafIncludesValue:
          Array.isArray(leafValues) && leafValues.includes(value)
      }
    },
    { hostNodeId, leafNodeId, hostWidgetName, leafWidgetName, value }
  )
}
