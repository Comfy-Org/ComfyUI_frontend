import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IImageCropWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  ImageCropInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useImageCropWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IImageCropWidget => {
    const { name, options = {} } = inputSpec as ImageCropInputSpec

    const widget = node.addWidget(
      'imagecrop',
      name,
      { x: 0, y: 0, width: 512, height: 512 },
      () => {},
      {
        serialize: true,
        ...options
      }
    ) as IImageCropWidget

    return widget
  }
}
