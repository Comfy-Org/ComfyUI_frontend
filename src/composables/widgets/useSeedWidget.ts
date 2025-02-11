import type { LGraphNode } from '@comfyorg/litegraph'

import {
  type ComfyWidgetConstructor,
  addValueControlWidget
} from '@/scripts/widgets'
import type { ComfyApp } from '@/types'
import type { InputSpec } from '@/types/apiTypes'

import { useIntWidget } from './useIntWidget'

export const useSeedWidget = () => {
  const IntWidget = useIntWidget()

  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app?: ComfyApp,
    widgetName?: string
  ) => {
    const seed = IntWidget(node, inputName, inputData, app)
    const seedControl = addValueControlWidget(
      node,
      seed.widget,
      'randomize',
      undefined,
      widgetName,
      inputData
    )

    seed.widget.linkedWidgets = [seedControl]
    return seed
  }

  return widgetConstructor
}
