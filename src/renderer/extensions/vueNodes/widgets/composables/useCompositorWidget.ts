import {
  emptyCompositorWidgetValue,
  isCompositorWidgetValue
} from '@/renderer/extensions/compositor/components/types'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ICompositorWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useCompositorWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): ICompositorWidget => {
    const defaultValue = isCompositorWidgetValue(inputSpec.default)
      ? inputSpec.default
      : emptyCompositorWidgetValue()

    const rawWidget = node.addWidget(
      'compositor',
      inputSpec.name,
      defaultValue,
      null
    )

    if (rawWidget.type !== 'compositor') {
      throw new Error(`Unexpected widget type: ${rawWidget.type}`)
    }

    return rawWidget as ICompositorWidget
  }
}
