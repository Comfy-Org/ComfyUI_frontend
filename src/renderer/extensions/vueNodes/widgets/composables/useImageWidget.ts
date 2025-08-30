import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IImageWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  ImageInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useImageWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IImageWidget => {
    const { name, options = {} } = inputSpec as ImageInputSpec

    const widget = node.addWidget('image', name, '', () => {}, {
      serialize: true,
      ...options
    }) as IImageWidget

    return widget
  }
}
