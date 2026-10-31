import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import type { IGalleriaWidget } from '@comfyorg/graph-model/widgets'
import { isGalleriaInputSpec } from '@comfyorg/graph-model/nodeDefSchemaV2'
import type {
  GalleriaInputSpec,
  InputSpec as InputSpecV2
} from '@comfyorg/graph-model/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

export const useGalleriaWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IGalleriaWidget => {
    if (!isGalleriaInputSpec(inputSpec)) {
      console.error('Invalid input spec for galleria widget')
    }

    const galleriaSpec = inputSpec as GalleriaInputSpec
    const { name } = galleriaSpec
    const images = galleriaSpec.images ?? galleriaSpec.options?.images ?? []

    const widget = node.addWidget('galleria', name, images, () => {}, {
      serialize: true
    }) as IGalleriaWidget

    return widget
  }
}
