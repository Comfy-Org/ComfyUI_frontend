import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IGalleriaWidget } from '@/lib/litegraph/src/types/widgets'
import { isGalleriaInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  GalleriaInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

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
