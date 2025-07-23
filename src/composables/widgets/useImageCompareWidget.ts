import type { LGraphNode } from '@comfyorg/litegraph'
import type { IImageCompareWidget } from '@comfyorg/litegraph/dist/types/widgets'

import type {
  ImageCompareInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useImageCompareWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IImageCompareWidget => {
    const { name, options = {} } = inputSpec as ImageCompareInputSpec

    const widget = node.addWidget('imagecompare', name, ['', ''], () => {}, {
      serialize: true,
      ...options
    }) as IImageCompareWidget

    return widget
  }
}
