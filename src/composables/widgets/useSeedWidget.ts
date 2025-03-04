import type { LGraphNode } from '@comfyorg/litegraph'

import { type InputSpec, isIntInputSpec } from '@/schemas/nodeDefSchema'
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
    if (!isIntInputSpec(inputData)) {
      throw new Error(`Invalid input data: ${inputData}`)
    }

    return IntWidget(
      node,
      inputName,
      [
        'INT',
        {
          ...inputData[1],
          control_after_generate: true
        }
      ],
      app,
      widgetName
    )
  }

  return widgetConstructor
}
