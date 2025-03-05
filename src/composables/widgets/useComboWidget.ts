import type { LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { transformInputSpecV2ToV1 } from '@/schemas/nodeDef/migration'
import {
  ComboInputSpec,
  type InputSpec,
  isComboInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  type ComfyWidgetConstructorV2,
  addValueControlWidgets
} from '@/scripts/widgets'

import { useRemoteWidget } from './useRemoteWidget'

const getDefaultValue = (inputSpec: ComboInputSpec) => {
  if (inputSpec.default) return inputSpec.default
  if (inputSpec.options?.length) return inputSpec.options[0]
  if (inputSpec.remote) return 'Loading...'
  return undefined
}

export const useComboWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isComboInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }

    const comboOptions = inputSpec.options ?? []
    const defaultValue = getDefaultValue(inputSpec)

    const widget = node.addWidget(
      'combo',
      inputSpec.name,
      defaultValue,
      () => {},
      {
        values: comboOptions
      }
    ) as IComboWidget

    if (inputSpec.remote) {
      const remoteWidget = useRemoteWidget({
        remoteConfig: inputSpec.remote,
        defaultValue,
        node,
        widget
      })
      if (inputSpec.remote.refresh_button) remoteWidget.addRefreshButton()

      const origOptions = widget.options
      widget.options = new Proxy(origOptions as Record<string | symbol, any>, {
        get(target, prop: string | symbol) {
          if (prop !== 'values') return target[prop]
          return remoteWidget.getValue()
        }
      })
    }

    if (inputSpec.control_after_generate) {
      widget.linkedWidgets = addValueControlWidgets(
        node,
        widget,
        undefined,
        undefined,
        transformInputSpecV2ToV1(inputSpec)
      )
    }
    return widget
  }

  return widgetConstructor
}
