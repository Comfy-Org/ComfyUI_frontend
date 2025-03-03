import type { LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import {
  type InputSpec,
  getComboSpecComboOptions,
  isComboInputSpec
} from '@/schemas/nodeDefSchema'
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
    if (!isComboInputSpec(inputData)) {
      throw new Error(`Invalid input data: ${inputData}`)
    }

    const widgetStore = useWidgetStore()
    const inputOptions = inputData[1] ?? {}
    const comboOptions = getComboSpecComboOptions(inputData)

    const defaultValue = widgetStore.getDefaultValue(inputData)

    const res = {
      widget: node.addWidget('combo', inputName, defaultValue, () => {}, {
        values: comboOptions
      }) as IComboWidget
    }

    if (inputOptions.remote) {
      const remoteWidget = useRemoteWidget({
        inputData,
        defaultValue,
        node,
        widget: res.widget
      })
      if (inputOptions.remote.refresh_button) remoteWidget.addRefreshButton()

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

    if (inputOptions.control_after_generate) {
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
