import type { LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import type { InputSpec } from '@/schemas/nodeDefSchema'
import { addValueControlWidgets } from '@/scripts/widgets'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useWidgetStore } from '@/stores/widgetStore'

import { useRemoteWidget } from './useRemoteWidget'

export const useComboWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec
  ) => {
    const widgetStore = useWidgetStore()
    const { remote, options } = inputData[1] || {}
    const defaultValue = widgetStore.getDefaultValue(inputData)

    const res = {
      widget: node.addWidget('combo', inputName, defaultValue, () => {}, {
        // @ts-expect-error InputSpec is not typed correctly
        values: options ?? inputData[0]
      }) as IComboWidget
    }

    if (remote) {
      const remoteWidget = useRemoteWidget({
        inputData,
        defaultValue,
        node,
        widget: res.widget
      })
      // @ts-expect-error InputSpec is not typed correctly
      if (remote.refresh_button) remoteWidget.addRefreshButton()

      const origOptions = res.widget.options
      res.widget.options = new Proxy(
        origOptions as Record<string | symbol, any>,
        {
          get(target, prop: string | symbol) {
            if (prop !== 'values') return target[prop]
            return remoteWidget.getValue()
          }
        }
      )
    }

    if (inputData[1]?.control_after_generate) {
      res.widget.linkedWidgets = addValueControlWidgets(
        node,
        res.widget,
        undefined,
        undefined,
        inputData
      )
    }
    return res
  }

  return widgetConstructor
}
