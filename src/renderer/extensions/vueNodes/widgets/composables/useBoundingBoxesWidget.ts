import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  BoundingBoxesInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import type { BoundingBox } from '@/types/boundingBoxes'

export const useBoundingBoxesWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IBaseWidget => {
    const spec = inputSpec as BoundingBoxesInputSpec
    const defaultValue: BoundingBox[] =
      spec.default?.map((box) => ({
        ...box,
        metadata: { ...box.metadata, palette: [...box.metadata.palette] }
      })) ?? []
    return node.addWidget('boundingboxes', spec.name, defaultValue, null, {
      serialize: true,
      canvasOnly: false,
      hideInPanel: true
    }) as IBaseWidget
  }
}
