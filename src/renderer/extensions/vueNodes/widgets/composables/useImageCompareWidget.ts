import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IImageCompareWidget } from '@comfyorg/graph-model/widgets'
import type {
  ImageCompareInputSpec,
  InputSpec as InputSpecV2
} from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

export const useImageCompareWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IImageCompareWidget => {
    const { name, options = {} } = inputSpec as ImageCompareInputSpec

    const widget = node.addWidget('imagecompare', name, ['', ''], () => {}, {
      serialize: true,
      ...options,
      hideInPanel: true
    }) as IImageCompareWidget

    widget.serialize = false

    return widget
  }
}
