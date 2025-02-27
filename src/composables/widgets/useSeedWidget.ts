import type { LGraphNode } from '@comfyorg/litegraph'

import type { InputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import type { ComfyApp } from '@/types'

import { useIntWidget } from './useIntWidget'

export const useSeedWidget = () => {
  const IntWidget = useIntWidget()

  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app: ComfyApp,
    widgetName?: string
  ) => {
    inputData[1] = {
      ...inputData[1],
      control_after_generate: true
    }
    return IntWidget(node, inputName, inputData, app, widgetName)
  }

  return widgetConstructor
}
